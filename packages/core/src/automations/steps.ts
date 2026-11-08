/** Doing one step of a run and saving its result, so a done step is never re-run (see docs/events.md). */

import { createHmac } from 'node:crypto';

import {
  and,
  type AutomationRun,
  automationSteps,
  eq,
  getDb,
  notificationDeliveries,
  notifications,
  type Tx,
} from '@app/db';

import { automationActor } from '../access';
import { getSiteUrl } from '../env';
import { notify } from '../notifications/notify';
import { durationMs, type FlatStep, type RunDefinition } from './definition';
import { type Context, render, renderText, unmetCondition } from './template';
import { EventContext, WaitingMatch, describeCondition, pause } from './runs';

/** Step outputs are kept small. */
const MAX_OUTPUT_BYTES = 32_000;

type Step = FlatStep;

type StepOutcome =
  | { kind: 'next' }
  | { kind: 'jump'; to: number }
  | { kind: 'paused' }
  | { kind: 'stop'; note: string }
  | { kind: 'fail'; error: string };

async function existingStep(runId: string, index: number) {
  const [row] = await getDb()
    .select()
    .from(automationSteps)
    .where(and(eq(automationSteps.runId, runId), eq(automationSteps.index, index)));
  return row;
}

export async function saveStep(
  db: Pick<Tx, 'insert'>,
  run: AutomationRun,
  index: number,
  step: Step,
  fields: { status: 'done' | 'failed' | 'waiting'; output?: unknown; error?: string | null },
) {
  const finished = fields.status === 'waiting' ? null : new Date();
  const values = {
    runId: run.id,
    index,
    type: step.type,
    status: fields.status,
    output: small(fields.output),
    error: fields.error ?? null,
    finishedAt: finished,
  };
  return db
    .insert(automationSteps)
    .values(values)
    .onConflictDoUpdate({
      target: [automationSteps.runId, automationSteps.index],
      set: {
        status: values.status,
        output: values.output,
        error: values.error,
        finishedAt: finished,
      },
    })
    .returning({ index: automationSteps.index });
}

export async function runStep(
  run: AutomationRun,
  step: Step,
  i: number,
  ctx: Context,
  now: Date,
): Promise<StepOutcome> {
  const db = getDb();
  const done = await existingStep(run.id, i);
  if (done?.status === 'done') {
    // A branch already decided: follow the same arm again.
    if (
      step.type === 'branch' &&
      (done.output as { matched?: boolean } | null)?.matched === false
    ) {
      return { kind: 'jump', to: step.elseAt };
    }
    return { kind: 'next' };
  }
  if (done?.status === 'failed' && step.type === 'action' && step.continueOnError) {
    return { kind: 'next' };
  }

  switch (step.type) {
    case 'action': {
      // Lazy: actions import the engine (automations.* actions), so import them at call time.
      const { runAction } = await import('../actions/run');
      const actor = automationActor({
        automationId: run.automationId,
        runId: run.id,
        depth: run.depth,
        idempotencyKey: `automation:${run.id}:${i}`,
      });
      const result = await runAction(step.action, render(step.input, ctx), actor);
      if (result.ok) {
        await saveStep(db, run, i, step, { status: 'done', output: result.data });
        return { kind: 'next' };
      }
      const e = result.error;
      const retryable =
        e.code === 'internal' ||
        e.code === 'rate_limited' ||
        Boolean((e.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds);
      // A temporary problem (outage, bug being fixed): retry the job, resume here.
      if (retryable) throw new Error(`${step.action}: ${e.message}`);
      await saveStep(db, run, i, step, {
        status: 'failed',
        output: { error: e },
        error: e.message,
      });
      if (step.continueOnError) return { kind: 'next' };
      return { kind: 'fail', error: `${step.action}: ${e.message}` };
    }

    case 'wait': {
      const until =
        done?.status === 'waiting'
          ? new Date((done.output as { until: string }).until)
          : new Date(now.getTime() + durationMs(step.for));
      if (until <= now) {
        await saveStep(db, run, i, step, {
          status: 'done',
          output: { until: until.toISOString() },
        });
        return { kind: 'next' };
      }
      await pause(run, i, step, until, null);
      return { kind: 'paused' };
    }

    case 'waitForEvent': {
      if (done?.status === 'waiting') {
        const until = new Date((done.output as { until: string }).until);
        if (until > now) {
          await pause(run, i, step, until, waitMatch(step, ctx));
          return { kind: 'paused' };
        }
        // Timed out — unless the event arrived a moment ago (dispatch finished the step).
        const [timedOut] = await db
          .update(automationSteps)
          .set({ status: 'done', output: { event: null, timedOut: true }, finishedAt: now })
          .where(
            and(
              eq(automationSteps.runId, run.id),
              eq(automationSteps.index, i),
              eq(automationSteps.status, 'waiting'),
            ),
          )
          .returning({ index: automationSteps.index });
        if (timedOut && step.onTimeout === 'stop') {
          return { kind: 'stop', note: `Stopped: no ${step.event} within ${step.timeout}` };
        }
        return { kind: 'next' };
      }
      await pause(
        run,
        i,
        step,
        new Date(now.getTime() + durationMs(step.timeout)),
        waitMatch(step, ctx),
      );
      return { kind: 'paused' };
    }

    case 'branch': {
      const unmet = unmetCondition(step.conditions, step.match, ctx);
      await saveStep(db, run, i, step, {
        status: 'done',
        output: { matched: !unmet, ...(unmet && { unmet: describeCondition(unmet) }) },
      });
      return unmet ? { kind: 'jump', to: step.elseAt } : { kind: 'next' };
    }

    case 'condition': {
      const failed = unmetCondition(step.conditions, step.match, ctx);
      await saveStep(db, run, i, step, {
        status: 'done',
        output: { passed: !failed, ...(failed && { failed: describeCondition(failed) }) },
      });
      return failed
        ? { kind: 'stop', note: `Stopped at step ${i + 1}: ${describeCondition(failed)}` }
        : { kind: 'next' };
    }

    case 'notifyStaff':
    case 'notifyContact':
    case 'sendEmail':
    case 'sendText': {
      // The step row and the notification commit together: never twice, never lost.
      const message = messageFor(step, ctx, (run.definition as RunDefinition).name);
      if (message.contactId !== null && !/^[0-9a-f-]{36}$/i.test(message.contactId)) {
        return { kind: 'fail', error: `${step.type}: “${message.contactId}” isn’t a contact id` };
      }
      const dedupeKey = `${run.id}:${i}`;
      await db.transaction(async (tx) => {
        const [claimed] = await saveStepOnce(tx, run, i, step);
        if (!claimed) return;
        const subject = (ctx.event as EventContext).subject ?? undefined;
        const common = { data: message.data, subject, dedupeKey, channels: message.channels };
        const notified = message.contactId
          ? await notify(tx, 'account.message', { ...common, to: message.contactId })
          : await notify(tx, 'staff.automationMessage', {
              ...common,
              to: { permission: (step as Extract<Step, { type: 'notifyStaff' }>).permission },
            });
        // What actually goes out (email via Resend, texts via Quo, push) — or why not.
        const deliveries = await tx
          .select({
            channel: notificationDeliveries.channel,
            status: notificationDeliveries.status,
            reason: notificationDeliveries.lastError,
          })
          .from(notificationDeliveries)
          .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
          .where(eq(notifications.dedupeKey, dedupeKey));
        const sent = deliveries.some((d) => d.status !== 'skipped');
        await tx
          .update(automationSteps)
          .set({
            output: {
              notified,
              sent,
              deliveries,
              ...(!sent && {
                note:
                  step.type === 'sendText'
                    ? 'No text sent: no phone, no SMS consent, texts turned off, or they turned these messages off.'
                    : 'Nothing sent beyond the in-app inbox (preferences, missing address or an opt-out).',
              }),
            },
          })
          .where(and(eq(automationSteps.runId, run.id), eq(automationSteps.index, i)));
      });
      return { kind: 'next' };
    }

    case 'webhook': {
      const secret = process.env.AUTOMATIONS_WEBHOOK_SECRET;
      if (!secret) {
        return {
          kind: 'fail',
          error:
            'webhook: AUTOMATIONS_WEBHOOK_SECRET isn’t set here, so the request can’t be signed',
        };
      }
      const delivery = `${run.id}:${i}`;
      const payload = JSON.stringify(
        step.body === undefined
          ? { event: ctx.event, automation: ctx.automation, run: ctx.run, site: getSiteUrl() }
          : render(step.body, ctx),
      );
      let res: Response;
      try {
        res = await fetch(step.url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'user-agent': 'App-Automations/1',
            'x-app-delivery': delivery,
            'x-app-event': String((ctx.event as EventContext).type),
            'x-app-signature': `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`,
          },
          body: payload,
          signal: AbortSignal.timeout(15_000),
        });
      } catch (err) {
        throw new Error(
          `webhook: couldn’t reach ${new URL(step.url).host} (${(err as Error).message})`,
        );
      }
      // The status is what matters; an unreadable body just means less detail in the run log.
      const responseText = (await res.text().catch(() => '')).slice(0, 500);
      if (res.ok) {
        await saveStep(db, run, i, step, { status: 'done', output: { status: res.status } });
        return { kind: 'next' };
      }
      // Their server is down or busy: retry. Anything else (404, 401 …) won't fix itself.
      if (res.status >= 500 || res.status === 408 || res.status === 429) {
        throw new Error(`webhook: ${new URL(step.url).host} answered ${res.status}`);
      }
      const error =
        `webhook: ${new URL(step.url).host} answered ${res.status} ${responseText}`.trim();
      await saveStep(db, run, i, step, { status: 'failed', output: { status: res.status }, error });
      return { kind: 'fail', error };
    }
  }
}

type MessageStep = Extract<
  Step,
  { type: 'notifyStaff' | 'notifyContact' | 'sendEmail' | 'sendText' }
>;

/** The four message steps as one notify() call: who, what, which channels. */
function messageFor(step: MessageStep, ctx: Context, automationName: string) {
  const url = 'url' in step && step.url ? { url: renderText(step.url, ctx) } : {};
  switch (step.type) {
    case 'notifyStaff':
      return {
        contactId: null,
        channels: step.channels,
        data: {
          title: renderText(step.title, ctx),
          body: renderText(step.body, ctx),
          ...url,
          automationName,
        },
      };
    case 'notifyContact':
      return {
        contactId: renderText(step.contactId, ctx),
        channels: step.channels,
        data: {
          title: renderText(step.title, ctx),
          body: renderText(step.body, ctx),
          ...(step.sms && { sms: renderText(step.sms, ctx) }),
          ...url,
          automationName,
        },
      };
    case 'sendEmail':
      return {
        contactId: renderText(step.contactId, ctx),
        channels: ['email'] as const,
        data: {
          title: renderText(step.subject, ctx),
          body: renderText(step.body, ctx),
          ...url,
          automationName,
        },
      };
    case 'sendText': {
      const text = renderText(step.text, ctx);
      return {
        contactId: renderText(step.contactId, ctx),
        channels: ['sms'] as const,
        data: { title: text.slice(0, 150), body: text, sms: text, automationName },
      };
    }
  }
}

/** Insert the step as done, only if it isn't already there (returns [] when it was). */
function saveStepOnce(tx: Tx, run: AutomationRun, index: number, step: Step) {
  return tx
    .insert(automationSteps)
    .values({ runId: run.id, index, type: step.type, status: 'done', finishedAt: new Date() })
    .onConflictDoNothing()
    .returning({ index: automationSteps.index });
}

function waitMatch(step: Extract<Step, { type: 'waitForEvent' }>, ctx: Context): WaitingMatch {
  return step.match ? { field: step.match.field, value: render(step.match.equals, ctx) } : null;
}

function small(value: unknown): unknown {
  if (value === undefined) return null;
  try {
    const json = JSON.stringify(value);
    return json.length > MAX_OUTPUT_BYTES
      ? { note: 'output too large to keep', size: json.length }
      : (JSON.parse(json) as unknown);
  } catch {
    // Expected: a step may return something JSON can't hold (cycles, BigInt).
    return { note: 'output is not JSON' };
  }
}

// ------------------------------------------------------------------ manage runs
