import {
  activityLog,
  and,
  automationRuns,
  cronRuns,
  eq,
  events,
  files,
  getDb,
  idempotencyKeys,
  inArray,
  isNotNull,
  jobs,
  lt,
  or,
  rateLimitHits,
} from '@app/db';

import { IDEMPOTENCY_TTL_MS } from './idempotency';
import { enqueue, getJob } from './jobs';

/** API/AI reads in the activity log are kept this long; changes are kept forever. */
export const READ_LOG_RETENTION_DAYS = 365;
/** Rate-limit counters only matter for the current window; a day is plenty. */
const RATE_LIMIT_RETENTION_HOURS = 24;
const BATCH = 5_000;
/** Finished background jobs are kept this long (failed ones three times as long). */
const JOB_RETENTION_DAYS = 30;
/** Events, finished automation runs and cron runs are kept this long. */
const EVENT_RETENTION_DAYS = 365;
const CRON_RUN_RETENTION_DAYS = 30;
/** An upload that was started but never finished is abandoned after this. */
const ABANDONED_UPLOAD_HOURS = 24;

export type MaintenanceResult = {
  readLogsDeleted: number;
  rateLimitRowsDeleted: number;
  idempotencyKeysDeleted: number;
  jobsDeleted: number;
  eventsDeleted: number;
  automationRunsDeleted: number;
  cronRunsDeleted: number;
  abandonedUploads: number;
};

/**
 * Housekeeping run once a day by /api/cron/maintenance (wrap it in `recordCronRun('maintenance', …)`):
 * - deletes activity-log READ rows (what an API key / AI looked at) older than READ_LOG_RETENTION_DAYS.
 *   Changes, sign-ins and the change log are never deleted.
 * - deletes old rate-limit counters, expired idempotency keys and old cron runs.
 * - deletes finished background jobs after JOB_RETENTION_DAYS (failed: 3×).
 * - deletes dispatched events and finished automation runs after EVENT_RETENTION_DAYS
 *   (runs still waiting are kept, however old — they carry a copy of their trigger).
 * - marks uploads that were started but never finished as deleted (and queues `files.deleteObject`
 *   for their bytes when the files module registered that job).
 * Deletes in batches so a big backlog never holds long locks.
 */
export async function runMaintenance(
  now = new Date(),
  deadlineMs = 40_000,
): Promise<MaintenanceResult> {
  const started = Date.now();
  const readCutoff = new Date(now.getTime() - READ_LOG_RETENTION_DAYS * 86_400_000);
  const counterCutoff = new Date(now.getTime() - RATE_LIMIT_RETENTION_HOURS * 3_600_000);

  let readLogsDeleted = 0;
  for (;;) {
    const db = getDb();
    const batch = db
      .select({ id: activityLog.id })
      .from(activityLog)
      .where(and(eq(activityLog.kind, 'read'), lt(activityLog.occurredAt, readCutoff)))
      .limit(BATCH);
    const deleted = await db
      .delete(activityLog)
      .where(inArray(activityLog.id, batch))
      .returning({ id: activityLog.id });
    readLogsDeleted += deleted.length;
    if (deleted.length < BATCH || Date.now() - started > deadlineMs) break;
  }

  const counters = await getDb()
    .delete(rateLimitHits)
    .where(lt(rateLimitHits.windowStart, counterCutoff))
    .returning({ key: rateLimitHits.key });
  const keys = await getDb()
    .delete(idempotencyKeys)
    .where(lt(idempotencyKeys.createdAt, new Date(now.getTime() - IDEMPOTENCY_TTL_MS)))
    .returning({ key: idempotencyKeys.key });
  const oldCronRuns = await getDb()
    .delete(cronRuns)
    .where(lt(cronRuns.startedAt, new Date(now.getTime() - CRON_RUN_RETENTION_DAYS * 86_400_000)))
    .returning({ id: cronRuns.id });

  const jobCutoff = new Date(now.getTime() - JOB_RETENTION_DAYS * 86_400_000);
  const failedCutoff = new Date(now.getTime() - 3 * JOB_RETENTION_DAYS * 86_400_000);
  const oldJobs = await getDb()
    .delete(jobs)
    .where(
      or(
        and(inArray(jobs.status, ['done', 'cancelled']), lt(jobs.updatedAt, jobCutoff)),
        and(eq(jobs.status, 'failed'), lt(jobs.updatedAt, failedCutoff)),
      ),
    )
    .returning({ id: jobs.id });

  const eventCutoff = new Date(now.getTime() - EVENT_RETENTION_DAYS * 86_400_000);
  const oldRuns = await getDb()
    .delete(automationRuns)
    .where(
      and(
        inArray(automationRuns.status, ['completed', 'failed', 'cancelled', 'skipped']),
        lt(automationRuns.createdAt, eventCutoff),
      ),
    )
    .returning({ id: automationRuns.id });
  const oldEvents = await getDb()
    .delete(events)
    .where(and(isNotNull(events.dispatchedAt), lt(events.occurredAt, eventCutoff)))
    .returning({ id: events.id });

  const abandoned = await getDb().transaction(async (tx) => {
    const rows = await tx
      .update(files)
      .set({ status: 'deleted' })
      .where(
        and(
          eq(files.status, 'pending'),
          lt(files.createdAt, new Date(now.getTime() - ABANDONED_UPLOAD_HOURS * 3_600_000)),
        ),
      )
      .returning({ bucket: files.bucket, path: files.path });
    if (getJob('files.deleteObject')) {
      for (const f of rows) await enqueue(tx, 'files.deleteObject', f);
    }
    return rows.length;
  });

  return {
    readLogsDeleted,
    rateLimitRowsDeleted: counters.length,
    idempotencyKeysDeleted: keys.length,
    jobsDeleted: oldJobs.length,
    eventsDeleted: oldEvents.length,
    automationRunsDeleted: oldRuns.length,
    cronRunsDeleted: oldCronRuns.length,
    abandonedUploads: abandoned,
  };
}
