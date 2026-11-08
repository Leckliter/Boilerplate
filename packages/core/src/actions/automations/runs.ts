import { randomUUID } from 'node:crypto';

import { and, automationRuns, automations, automationSteps, desc, eq, inArray } from '@app/db';
import { z } from 'zod';

import { cancelRun, type RunDefinition, retryRun, startRun } from '../../automations';
import { getEventType } from '../../events';
import { ActionError, defineAction } from '../define';
import { AUDIENCE, runStatus, automationOrThrow } from './shared';

/** Start, list, read, cancel and retry automation runs. */

export const runAutomation = defineAction({
  name: 'automations.run',
  title: 'Run an automation now',
  description:
    'Start a run right now (even if the automation is off) — to test it, or to do it by hand. For an event trigger, `data` ' +
    'is the pretend event’s data (default: the event’s example, whose ids don’t exist). Conditions still apply. ' +
    'Steps REALLY run (messages are sent, records change), so test with real records you own.',
  audience: AUDIENCE,
  mutates: true,
  returns: '{ status: started | skipped | conditions, runId?, reason? }',
  input: z.object({
    id: z.uuid(),
    data: z.record(z.string(), z.unknown()).optional().describe('Event data for the run'),
  }),
  async run({ input, actor, tx, log }) {
    const a = await automationOrThrow(tx, input.id);
    if (a.archivedAt) throw new ActionError('conflict', 'That automation is archived.');
    const eventType = a.triggerEvent ? getEventType(a.triggerEvent) : null;
    let data: Record<string, unknown> = input.data ?? {};
    if (eventType) {
      const parsed = eventType.data.safeParse(input.data ?? eventType.example);
      if (!parsed.success) {
        throw new ActionError(
          'invalid_input',
          `data doesn’t fit ${eventType.type}: ${z.prettifyError(parsed.error)}`,
        );
      }
      data = parsed.data as Record<string, unknown>;
    }
    const now = new Date();
    const subjectId = eventType?.subject?.id(data) ?? null;
    const outcome = await startRun(tx, a, {
      key: `manual:${randomUUID()}`,
      trigger: {
        kind: 'manual',
        event: {
          id: null,
          type: a.triggerEvent ?? 'manual',
          data,
          subject: subjectId ? { type: eventType!.subject!.type, id: subjectId } : null,
          occurredAt: now.toISOString(),
        },
      },
      startedByContactId: actor.contactId,
      now,
    });
    log({
      subjectType: 'automation',
      subjectId: a.id,
      summary: `Ran automation “${a.name}” by hand: ${outcome.status}`,
    });
    return outcome;
  },
});

// ------------------------------------------------------------------ runs

export const listRuns = defineAction({
  name: 'automations.listRuns',
  title: 'List automation runs',
  description:
    'Automation runs, newest first, across all automations or one: status (running, waiting, completed, failed, ' +
    'cancelled, skipped), the step it is on, what it is waiting for, and errors.',
  audience: AUDIENCE,
  mutates: false,
  returns:
    '[{ id, automationId, automationName, status, currentStep, wakeAt, waitingEvent, note, error, createdAt, finishedAt }]',
  input: z.object({
    automationId: z.uuid().optional(),
    status: z.array(runStatus).optional(),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  async run({ input, tx }) {
    return tx
      .select({
        id: automationRuns.id,
        automationId: automationRuns.automationId,
        automationName: automations.name,
        status: automationRuns.status,
        triggerKey: automationRuns.triggerKey,
        currentStep: automationRuns.currentStep,
        wakeAt: automationRuns.wakeAt,
        waitingEvent: automationRuns.waitingEvent,
        note: automationRuns.note,
        error: automationRuns.error,
        createdAt: automationRuns.createdAt,
        finishedAt: automationRuns.finishedAt,
      })
      .from(automationRuns)
      .innerJoin(automations, eq(automations.id, automationRuns.automationId))
      .where(
        and(
          input.automationId ? eq(automationRuns.automationId, input.automationId) : undefined,
          input.status?.length ? inArray(automationRuns.status, input.status) : undefined,
        ),
      )
      .orderBy(desc(automationRuns.createdAt))
      .limit(input.limit);
  },
});

export const getRun = defineAction({
  name: 'automations.getRun',
  title: 'Get an automation run',
  description:
    'One run in full: what triggered it, each step (its definition, status, output or error) and where it is now.',
  audience: AUDIENCE,
  mutates: false,
  returns:
    '{ run, automation: { id, name }, steps: [{ index, step, status, output, error, startedAt, finishedAt }] } — ' +
    'steps are flattened: a branch step has elseAt/endAt (its yes steps are index+1 … elseAt-1, its no steps elseAt … endAt-1); ' +
    'status “skipped” = on the branch arm that wasn’t taken.',
  input: z.object({ id: z.uuid() }),
  async run({ input, tx }) {
    const [run] = await tx.select().from(automationRuns).where(eq(automationRuns.id, input.id));
    if (!run) throw new ActionError('not_found', 'No such run.');
    const [a] = await tx
      .select({ id: automations.id, name: automations.name })
      .from(automations)
      .where(eq(automations.id, run.automationId));
    const rows = await tx
      .select()
      .from(automationSteps)
      .where(eq(automationSteps.runId, run.id))
      .orderBy(automationSteps.index);
    const definition = run.definition as RunDefinition;
    const branched = definition.steps.some((s) => s.type === 'branch');
    return {
      run: {
        id: run.id,
        status: run.status,
        triggerKey: run.triggerKey,
        trigger: run.trigger,
        eventId: run.eventId,
        currentStep: run.currentStep,
        wakeAt: run.wakeAt,
        waitingEvent: run.waitingEvent,
        waitingMatch: run.waitingMatch,
        cancelOn: run.cancelOn,
        concurrencyKey: run.concurrencyKey,
        automationVersion: run.automationVersion,
        note: run.note,
        error: run.error,
        createdAt: run.createdAt,
        finishedAt: run.finishedAt,
      },
      automation: a ?? null,
      steps: definition.steps.map((step, index) => {
        const r = rows.find((x) => x.index === index);
        return {
          index,
          step,
          // No saved result before the current step: skipped by a branch (or, before branches, a step
          // whose result was cleaned up).
          status:
            r?.status ??
            (index < run.currentStep ? (branched ? 'skipped' : 'done') : 'not reached'),
          output: r?.output ?? null,
          error: r?.error ?? null,
          startedAt: r?.startedAt ?? null,
          finishedAt: r?.finishedAt ?? null,
        };
      }),
    };
  },
});

export const cancelRunAction = defineAction({
  name: 'automations.cancelRun',
  title: 'Cancel an automation run',
  description: 'Stop a run that is still going or waiting. Steps already done are not undone.',
  audience: AUDIENCE,
  mutates: true,
  destructive: true,
  returns: '{ id, status }',
  input: z.object({ id: z.uuid() }),
  async run({ input, actor, tx, log }) {
    const ok = await cancelRun(
      tx,
      input.id,
      `Cancelled by ${actor.contactId ? 'staff' : actor.kind}`,
    );
    if (!ok) throw new ActionError('conflict', 'Only a run that is still going can be cancelled.');
    log({
      subjectType: 'automation_run',
      subjectId: input.id,
      summary: 'Cancelled an automation run',
    });
    return { id: input.id, status: 'cancelled' as const };
  },
});

export const retryRunAction = defineAction({
  name: 'automations.retryRun',
  title: 'Retry a failed run',
  description:
    'Resume a failed run at the step that failed. Steps that already finished are NOT repeated. Fix the cause first ' +
    '(see the run’s error).',
  audience: AUDIENCE,
  mutates: true,
  returns: '{ id, status }',
  input: z.object({ id: z.uuid() }),
  async run({ input, tx, log }) {
    const [run] = await tx
      .select()
      .from(automationRuns)
      .where(eq(automationRuns.id, input.id))
      .for('update');
    if (!run) throw new ActionError('not_found', 'No such run.');
    if (run.status !== 'failed') {
      throw new ActionError(
        'conflict',
        `That run is ${run.status}; only failed runs can be retried.`,
      );
    }
    await retryRun(tx, run);
    log({
      subjectType: 'automation_run',
      subjectId: run.id,
      summary: `Retrying an automation run from step ${run.currentStep + 1}`,
    });
    return { id: run.id, status: 'running' as const };
  },
});
