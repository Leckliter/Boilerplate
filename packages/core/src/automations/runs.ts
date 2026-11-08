/** Starting, dispatching, advancing, pausing and finishing runs (see docs/events.md). */

import {
  and,
  type AppEvent,
  type Automation,
  type AutomationRun,
  automationRuns,
  automations,
  automationSteps,
  eq,
  events,
  getDb,
  inArray,
  isNull,
  sql,
  type Tx,
} from '@app/db';

import { emit } from '../events/emit';
import { enqueue } from '../jobs/enqueue';
import { notify } from '../notifications/notify';
import {
  type CancelRule,
  type Condition,
  type FlatStep,
  flattenSteps,
  nextIndex,
  type RunDefinition,
  type Step,
  triggerSchema,
} from './definition';
import { dueSlot } from './schedule';
import { type Context, failedCondition, lookup, render, renderText, same } from './template';
import { runStep, saveStep } from './steps';

/** Chains deeper than this (automation → event → automation …) stop: almost certainly a loop. */
const MAX_DEPTH = 5;
/** How long one runner may hold a run before another may take over (it died). */
const LEASE_MS = 5 * 60_000;
/** Work this long per job, then continue in a fresh job (stays far below Vercel's limit). */
const SLICE_MS = 25_000;
export type TriggerInfo = {
  kind: 'event' | 'schedule' | 'manual';
  /** The trigger event as templates see it: {{event.data.…}}. */
  event: EventContext;
};

export type EventContext = {
  id: string | null;
  type: string;
  data: Record<string, unknown>;
  subject: { type: string; id: string } | null;
  occurredAt: string;
};

function eventContext(ev: AppEvent): EventContext {
  return {
    id: ev.id,
    type: ev.type,
    data: ev.data as Record<string, unknown>,
    subject: ev.subjectType && ev.subjectId ? { type: ev.subjectType, id: ev.subjectId } : null,
    occurredAt: ev.occurredAt.toISOString(),
  };
}

type RenderedCancel = { event: string; field: string | null; value: unknown };
export type WaitingMatch = { field: string; value: unknown } | null;

// ------------------------------------------------------------------ starting runs

export type StartOutcome =
  | { status: 'started'; runId: string }
  | { status: 'duplicate'; runId: string }
  | { status: 'skipped'; runId: string; reason: string }
  | { status: 'conditions'; reason: string };

/**
 * Start a run of `automation` for one trigger. `key` makes it happen once:
 * a second call with the same automation + key returns the first run.
 */
export async function startRun(
  tx: Tx,
  automation: Automation,
  opts: {
    key: string;
    trigger: TriggerInfo;
    eventId?: string | null;
    depth?: number;
    startedByContactId?: string | null;
    now?: Date;
  },
): Promise<StartOutcome> {
  const now = opts.now ?? new Date();
  const ctx: Context = {
    event: opts.trigger.event,
    automation: { id: automation.id, name: automation.name },
    now: now.toISOString(),
  };
  const failed = failedCondition(automation.conditions as Condition[], ctx);
  if (failed) return { status: 'conditions', reason: describeCondition(failed) };

  const concurrencyKey = automation.concurrencyKey
    ? renderText(automation.concurrencyKey, ctx) || null
    : null;
  const cancelOn: RenderedCancel[] = (automation.cancelOn as CancelRule[]).map((r) => ({
    event: r.event,
    field: r.match?.field ?? null,
    value: r.match ? render(r.match.equals, ctx) : null,
  }));
  const definition: RunDefinition = {
    name: automation.name,
    // Branches become one flat list (see flattenSteps), so every step has an index.
    steps: flattenSteps(automation.steps as Step[]),
  };
  const base = {
    automationId: automation.id,
    automationVersion: automation.version,
    definition,
    triggerKey: opts.key,
    trigger: opts.trigger,
    eventId: opts.eventId ?? null,
    depth: opts.depth ?? 0,
    concurrencyKey,
    cancelOn,
    cancelEvents: [...new Set(cancelOn.map((c) => c.event))],
    startedByContactId: opts.startedByContactId ?? null,
    createdAt: now,
  };
  const [row] = await tx
    .insert(automationRuns)
    .values({ ...base, status: 'running' })
    .onConflictDoNothing()
    .returning({ id: automationRuns.id });
  if (row) {
    await enqueue(tx, 'automations.advance', { runId: row.id }, { dedupeKey: `${row.id}:start` });
    return { status: 'started', runId: row.id };
  }
  const [dup] = await tx
    .select({ id: automationRuns.id })
    .from(automationRuns)
    .where(
      and(eq(automationRuns.automationId, automation.id), eq(automationRuns.triggerKey, opts.key)),
    );
  if (dup) return { status: 'duplicate', runId: dup.id };
  // The other unique rule: a run with the same concurrency key is still going.
  const reason = `Another run for “${concurrencyKey}” is still going.`;
  const [skipped] = await tx
    .insert(automationRuns)
    .values({ ...base, status: 'skipped', note: reason, finishedAt: now })
    .returning({ id: automationRuns.id });
  return { status: 'skipped', runId: skipped!.id, reason };
}

export function describeCondition(c: Condition) {
  return `Condition not met: ${c.path} ${c.op}${c.value === undefined ? '' : ` ${JSON.stringify(c.value)}`}`;
}

// ------------------------------------------------------------------ dispatching events

export type DispatchResult = {
  started: number;
  resumed: number;
  cancelled: number;
  skipped: number;
  already?: true;
};

/**
 * Hand one event to everything listening, in ONE transaction with the event
 * row locked: cancel runs that stop on it, resume runs waiting for it, start
 * automations triggered by it. Marked dispatched in the same transaction, so a
 * repeat (job retry) does nothing.
 */
export async function dispatchEvent(eventId: string, now = new Date()): Promise<DispatchResult> {
  return getDb().transaction(async (tx) => {
    const result: DispatchResult = { started: 0, resumed: 0, cancelled: 0, skipped: 0 };
    const [ev] = await tx.select().from(events).where(eq(events.id, eventId)).for('update');
    if (!ev) return result;
    if (ev.dispatchedAt) return { ...result, already: true };
    const evCtx = eventContext(ev);
    const matches = (field: string | null, value: unknown) =>
      !field || same(lookup(evCtx, field), value);

    // 1. Runs that stop when this happens (e.g. the rental came back).
    const cancellable = await tx
      .select()
      .from(automationRuns)
      .where(
        and(
          inArray(automationRuns.status, ['running', 'waiting']),
          sql`${ev.type} = any(${automationRuns.cancelEvents})`,
        ),
      )
      .for('update');
    for (const run of cancellable) {
      const hit = (run.cancelOn as RenderedCancel[]).some(
        (r) => r.event === ev.type && matches(r.field, r.value),
      );
      if (!hit) continue;
      await tx
        .update(automationRuns)
        .set({
          status: 'cancelled',
          note: `Stopped by ${ev.type}`,
          finishedAt: now,
          waitingEvent: null,
          waitingMatch: null,
          wakeAt: null,
        })
        .where(eq(automationRuns.id, run.id));
      result.cancelled++;
    }

    // 2. Runs waiting for this event.
    const waiting = await tx
      .select()
      .from(automationRuns)
      .where(and(eq(automationRuns.status, 'waiting'), eq(automationRuns.waitingEvent, ev.type)))
      .for('update');
    for (const run of waiting) {
      const m = run.waitingMatch as WaitingMatch;
      if (m && !matches(m.field, m.value)) continue;
      const [step] = await tx
        .update(automationSteps)
        .set({ status: 'done', output: { event: evCtx, timedOut: false }, finishedAt: now })
        .where(
          and(
            eq(automationSteps.runId, run.id),
            eq(automationSteps.index, run.currentStep),
            eq(automationSteps.status, 'waiting'),
          ),
        )
        .returning({ index: automationSteps.index });
      if (!step) continue;
      await tx
        .update(automationRuns)
        .set({
          status: 'running',
          waitingEvent: null,
          waitingMatch: null,
          wakeAt: null,
          currentStep: nextIndex((run.definition as RunDefinition).steps, run.currentStep),
        })
        .where(eq(automationRuns.id, run.id));
      await enqueue(
        tx,
        'automations.advance',
        { runId: run.id },
        { dedupeKey: `${run.id}:${run.currentStep}:resume` },
      );
      result.resumed++;
    }

    // 3. Automations this event starts.
    if (ev.depth < MAX_DEPTH) {
      const listening = await tx
        .select()
        .from(automations)
        .where(
          and(
            eq(automations.triggerEvent, ev.type),
            eq(automations.enabled, true),
            isNull(automations.archivedAt),
          ),
        );
      for (const automation of listening) {
        // An automation never triggers itself (directly or through its own failure).
        if (automation.id === ev.causeAutomationId) continue;
        const outcome = await startRun(tx, automation, {
          key: `event:${ev.id}`,
          trigger: { kind: 'event', event: evCtx },
          eventId: ev.id,
          depth: ev.depth,
          now,
        });
        if (outcome.status === 'started') result.started++;
        if (outcome.status === 'skipped') result.skipped++;
      }
    }

    await tx.update(events).set({ dispatchedAt: now }).where(eq(events.id, ev.id));
    return result;
  });
}

/**
 * Start schedule-triggered automations whose slot is due (called every minute
 * by cron). One run per automation + slot, however often this is called.
 */
export async function startScheduledAutomations(now = new Date()): Promise<number> {
  const scheduled = await getDb()
    .select()
    .from(automations)
    .where(
      and(
        eq(automations.enabled, true),
        isNull(automations.archivedAt),
        sql`${automations.trigger}->>'type' = 'schedule'`,
      ),
    );
  let started = 0;
  for (const automation of scheduled) {
    const trigger = triggerSchema.safeParse(automation.trigger);
    if (!trigger.success || trigger.data.type !== 'schedule') continue;
    const slot = dueSlot(trigger.data, now);
    if (!slot) continue;
    const outcome = await getDb().transaction((tx) =>
      startRun(tx, automation, {
        key: `schedule:${slot}`,
        trigger: {
          kind: 'schedule',
          event: {
            id: null,
            type: 'schedule',
            data: { slot, at: now.toISOString() },
            subject: null,
            occurredAt: now.toISOString(),
          },
        },
        now,
      }),
    );
    if (outcome.status === 'started') started++;
  }
  return started;
}

// ------------------------------------------------------------------ advancing runs

export type AdvanceResult =
  'completed' | 'waiting' | 'continued' | 'failed' | 'stopped' | 'not running';

/** Thrown when another runner holds the run; the job retries shortly. */
class RunBusyError extends Error {
  constructor() {
    super('Another runner is working on this automation run; trying again shortly.');
  }
}

/**
 * Work through a run's steps until it finishes, pauses or the time slice is
 * used up (then a fresh job continues). A thrown error = a step hit a
 * temporary problem: the job retries with backoff and resumes at that step.
 */
export async function advanceRun(
  runId: string,
  opts: { lastAttempt?: boolean; now?: () => Date } = {},
): Promise<AdvanceResult> {
  const now = opts.now ?? (() => new Date());
  const db = getDb();
  const t = now();
  // Claim it: running, or waiting and its time has come. Clears the wait (a timeout).
  const [run] = await db
    .update(automationRuns)
    .set({
      leaseUntil: new Date(t.getTime() + LEASE_MS),
      status: 'running',
      waitingEvent: null,
      waitingMatch: null,
      wakeAt: null,
    })
    .where(
      and(
        eq(automationRuns.id, runId),
        sql`(${automationRuns.leaseUntil} is null or ${automationRuns.leaseUntil} < ${t.toISOString()}::timestamptz)`,
        sql`(${automationRuns.status} = 'running' or (${automationRuns.status} = 'waiting' and ${automationRuns.wakeAt} <= ${t.toISOString()}::timestamptz))`,
      ),
    )
    .returning();
  if (!run) {
    const [current] = await db
      .select({ status: automationRuns.status, leaseUntil: automationRuns.leaseUntil })
      .from(automationRuns)
      .where(eq(automationRuns.id, runId));
    if (current?.status === 'running') throw new RunBusyError();
    return 'not running';
  }

  const definition = run.definition as RunDefinition;
  const started = Date.now();
  let released = false;
  try {
    for (let i = run.currentStep; ;) {
      if (i >= definition.steps.length) {
        await finish(run, 'completed', null);
        released = true;
        return 'completed';
      }
      const [fresh] = await db
        .select({ status: automationRuns.status })
        .from(automationRuns)
        .where(eq(automationRuns.id, run.id));
      if (fresh?.status !== 'running') return 'stopped'; // cancelled while we worked
      if (Date.now() - started > SLICE_MS) {
        await db.transaction(async (tx) => {
          await tx
            .update(automationRuns)
            .set({ leaseUntil: null, currentStep: i })
            .where(eq(automationRuns.id, run.id));
          await enqueue(
            tx,
            'automations.advance',
            { runId: run.id },
            { dedupeKey: `${run.id}:${i}:next` },
          );
        });
        released = true;
        return 'continued';
      }
      const outcome = await runStep(run, definition.steps[i]!, i, await context(run, now()), now());
      if (outcome.kind === 'next' || outcome.kind === 'jump') {
        // A branch whose conditions don't hold jumps to its else steps.
        i = outcome.kind === 'jump' ? outcome.to : nextIndex(definition.steps, i);
        await db
          .update(automationRuns)
          .set({ currentStep: i })
          .where(eq(automationRuns.id, run.id));
        continue;
      }
      if (outcome.kind === 'paused') {
        released = true;
        return 'waiting';
      }
      if (outcome.kind === 'stop') {
        await finish(run, 'completed', outcome.note);
        released = true;
        return 'completed';
      }
      await failRun(run, outcome.error);
      released = true;
      return 'failed';
    }
  } catch (err) {
    if (opts.lastAttempt) {
      await failRun(run, `Gave up after retries: ${String((err as Error)?.message ?? err)}`);
      released = true;
    }
    throw err;
  } finally {
    if (!released) {
      await db
        .update(automationRuns)
        .set({ leaseUntil: null })
        .where(eq(automationRuns.id, run.id));
    }
  }
}

/** What templates see: the trigger, earlier steps' outputs, the run. */
async function context(run: AutomationRun, now: Date): Promise<Context> {
  const definition = run.definition as RunDefinition;
  const rows = await getDb()
    .select({
      index: automationSteps.index,
      output: automationSteps.output,
      status: automationSteps.status,
    })
    .from(automationSteps)
    .where(eq(automationSteps.runId, run.id));
  const steps: Record<string, unknown> = {};
  for (const r of rows) {
    if (r.status === 'waiting') continue;
    steps[String(r.index)] = r.output;
    const id = definition.steps[r.index]?.id;
    if (id) steps[id] = r.output;
  }
  return {
    event: (run.trigger as TriggerInfo).event,
    steps,
    run: { id: run.id, startedAt: run.createdAt.toISOString() },
    automation: { id: run.automationId, name: definition.name },
    now: now.toISOString(),
  };
}

/** Pause until `until` (a wait, or a waitForEvent's timeout): step row, run state and wake-up job together. */
export async function pause(
  run: AutomationRun,
  index: number,
  step: FlatStep,
  until: Date,
  match: WaitingMatch,
) {
  await getDb().transaction(async (tx) => {
    await saveStep(tx, run, index, step, {
      status: 'waiting',
      output: { until: until.toISOString() },
    });
    await tx
      .update(automationRuns)
      .set({
        status: 'waiting',
        currentStep: index,
        wakeAt: until,
        waitingEvent: step.type === 'waitForEvent' ? step.event : null,
        waitingMatch: step.type === 'waitForEvent' ? match : null,
        leaseUntil: null,
      })
      .where(and(eq(automationRuns.id, run.id), eq(automationRuns.status, 'running')));
    await enqueue(
      tx,
      'automations.advance',
      { runId: run.id },
      { runAt: until, dedupeKey: `${run.id}:${index}:wake` },
    );
  });
}

async function finish(run: AutomationRun, status: 'completed', note: string | null) {
  await getDb()
    .update(automationRuns)
    .set({ status, note, finishedAt: new Date(), leaseUntil: null })
    .where(and(eq(automationRuns.id, run.id), eq(automationRuns.status, 'running')));
}

/** Stop the run with an error, tell automations.manage (once a day per automation), emit automation.failed. */
async function failRun(run: AutomationRun, error: string) {
  const name = (run.definition as RunDefinition).name;
  await getDb().transaction(async (tx) => {
    const [failed] = await tx
      .update(automationRuns)
      .set({
        status: 'failed',
        error: error.slice(0, 2_000),
        finishedAt: new Date(),
        leaseUntil: null,
      })
      .where(
        and(eq(automationRuns.id, run.id), inArray(automationRuns.status, ['running', 'waiting'])),
      )
      .returning({ id: automationRuns.id });
    if (!failed) return;
    const data = { automationId: run.automationId, automationName: name, runId: run.id, error };
    await notify(tx, 'staff.automationFailed', {
      to: { permission: 'automations.manage' },
      data,
      subject: { type: 'automation', id: run.automationId },
      dedupeKey: `${run.automationId}:${new Date().toISOString().slice(0, 10)}`,
    });
    // Marked as caused by this automation, so it never triggers itself.
    await tx.execute(
      sql`select set_config('app.automation_cause', ${JSON.stringify({ automationId: run.automationId, runId: run.id, depth: run.depth })}, true)`,
    );
    await emit(
      tx,
      'automation.failed',
      { ...data, error: error.slice(0, 500) },
      { dedupeKey: run.id },
    );
  });
}

/** Cancel a run that is still going. Returns false if it had already finished. */
export async function cancelRun(tx: Tx, runId: string, note: string): Promise<boolean> {
  const [row] = await tx
    .update(automationRuns)
    .set({
      status: 'cancelled',
      note,
      finishedAt: new Date(),
      waitingEvent: null,
      waitingMatch: null,
      wakeAt: null,
    })
    .where(
      and(eq(automationRuns.id, runId), inArray(automationRuns.status, ['running', 'waiting'])),
    )
    .returning({ id: automationRuns.id });
  return Boolean(row);
}

/** Resume a failed run at the step that failed (that step runs again; earlier ones don't). */
export async function retryRun(tx: Tx, run: AutomationRun): Promise<void> {
  await tx
    .delete(automationSteps)
    .where(
      and(
        eq(automationSteps.runId, run.id),
        eq(automationSteps.index, run.currentStep),
        eq(automationSteps.status, 'failed'),
      ),
    );
  await tx
    .update(automationRuns)
    .set({ status: 'running', error: null, errorRef: null, finishedAt: null, leaseUntil: null })
    .where(eq(automationRuns.id, run.id));
  await enqueue(
    tx,
    'automations.advance',
    { runId: run.id },
    { dedupeKey: `${run.id}:retry:${Date.now()}` },
  );
}
