import { jobs, sql, type Tx } from '@app/db';

import { getJob } from './registry';

export type EnqueueOptions = {
  /** Not before this time (default: now). */
  runAt?: Date;
  /** While a job of this type with this key is pending or running, don't queue another. */
  dedupeKey?: string;
  maxAttempts?: number;
};

/**
 * Queue a background job. Call it INSIDE the action's transaction, so the job
 * exists only if the action's changes are saved. The runner picks it up right
 * after the request (or within a minute, from cron). Returns the job id, or
 * null when an identical job (same dedupeKey) is already waiting.
 */
export async function enqueue(
  tx: Tx,
  type: string,
  payload: unknown,
  opts: EnqueueOptions = {},
): Promise<string | null> {
  const job = getJob(type);
  if (!job) throw new Error(`Unknown job type "${type}"`);
  const parsed = job.payload.parse(payload);
  const [row] = await tx
    .insert(jobs)
    .values({
      type,
      payload: parsed as object,
      runAt: opts.runAt ?? new Date(),
      maxAttempts: opts.maxAttempts ?? job.maxAttempts ?? 5,
      dedupeKey: opts.dedupeKey ?? null,
      activityId: sql`nullif(current_setting('app.activity_id', true), '')::uuid`,
    })
    .onConflictDoNothing()
    .returning({ id: jobs.id });
  return row?.id ?? null;
}
