import { events, sql, type Tx } from '@app/db';

import { enqueue } from '../jobs/enqueue';
import { type EventDataMap, type EventName, getEventType } from './catalog';

export type EmitOptions = {
  /** The same event type + key is only recorded once (e.g. a Stripe event id, order id + due time). */
  dedupeKey?: string;
  occurredAt?: Date;
};

/** Automation runs mark the changes they make (actions/run.ts), so their events carry the cause. */
type Cause = { automationId: string; runId: string; depth: number };

/**
 * Record that something happened. Call it INSIDE the transaction that made the
 * change (an outbox): the event exists only if the change is saved, and can't
 * be lost once it is. A background job then starts, resumes or cancels the
 * automations listening for it — each exactly once. See docs/automations.md.
 *
 * Returns the event id, or null if this event (type + dedupeKey) was already recorded.
 */
export async function emit<K extends EventName>(
  tx: Tx,
  type: K,
  data: EventDataMap[K],
  opts: EmitOptions = {},
): Promise<string | null> {
  const def = getEventType(type);
  if (!def) throw new Error(`Unknown event type "${type}"`);
  const parsed = def.data.parse(data) as Record<string, unknown>;
  const [ctx] = await tx.execute<{ cause: string | null }>(
    sql`select nullif(current_setting('app.automation_cause', true), '') as cause`,
  );
  const cause = ctx?.cause ? (JSON.parse(ctx.cause) as Cause) : null;
  const subjectId = def.subject?.id(parsed) ?? null;
  const [row] = await tx
    .insert(events)
    .values({
      type,
      data: parsed,
      subjectType: subjectId ? def.subject!.type : null,
      subjectId,
      dedupeKey: opts.dedupeKey ?? null,
      activityId: sql`nullif(current_setting('app.activity_id', true), '')::uuid`,
      causeAutomationId: cause?.automationId ?? null,
      causeRunId: cause?.runId ?? null,
      depth: cause ? cause.depth + 1 : 0,
      occurredAt: opts.occurredAt ?? new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: events.id });
  if (!row) return null;
  await enqueue(tx, 'events.dispatch', { eventId: row.id }, { dedupeKey: row.id });
  return row.id;
}
