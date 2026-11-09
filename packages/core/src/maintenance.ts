import {
  activityLog,
  and,
  cronRuns,
  eq,
  getDb,
  idempotencyKeys,
  inArray,
  jobs,
  lt,
  or,
  rateLimitHits,
} from '@app/db';

import { IDEMPOTENCY_TTL_MS } from './idempotency';
import { reportError } from './errors/report';
import { listMaintenanceSteps } from './maintenance-steps';

/** API/AI reads in the activity log are kept this long; changes are kept forever. */
export const READ_LOG_RETENTION_DAYS = 365;
/** Rate-limit counters only matter for the current window; a day is plenty. */
const RATE_LIMIT_RETENTION_HOURS = 24;
const BATCH = 5_000;
/** Finished background jobs are kept this long (failed ones three times as long). */
const JOB_RETENTION_DAYS = 30;
/** Cron-run records are kept this long. */
const CRON_RUN_RETENTION_DAYS = 30;

export type MaintenanceResult = {
  readLogsDeleted: number;
  rateLimitRowsDeleted: number;
  idempotencyKeysDeleted: number;
  jobsDeleted: number;
  cronRunsDeleted: number;
  /**
   * What each module's daily step returned (`{ error }` for one that failed — it was reported):
   * `events.retention` { eventsDeleted, automationRunsDeleted } and `files.abandoned`
   * { abandonedUploads } when those modules are on, `account.deletions` { processed … }.
   */
  steps: Record<string, unknown>;
};

/**
 * Housekeeping run once a day by /api/cron/maintenance (wrap it in `recordCronRun('maintenance', …)`):
 * - deletes activity-log READ rows (what an API key / AI looked at) older than READ_LOG_RETENTION_DAYS.
 *   Changes, sign-ins and the change log are never deleted.
 * - deletes old rate-limit counters, expired idempotency keys and old cron runs.
 * - deletes finished background jobs after JOB_RETENTION_DAYS (failed: 3×).
 * - runs the daily steps modules registered (`registerMaintenanceStep`), so this file touches no
 *   module table: `events.retention` deletes dispatched events and finished automation runs after a
 *   year, `files.abandoned` marks uploads that never finished as deleted (and queues
 *   `files.deleteObject`), `account.deletions` anonymises accounts whose grace period is over.
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

  // Module steps: one failing never stops the others (or the cleanup above, already done).
  const stepResults: Record<string, unknown> = {};
  for (const [name, step] of listMaintenanceSteps()) {
    try {
      stepResults[name] = await step(now);
    } catch (err) {
      const ref = await reportError(err, { source: 'job', context: { maintenanceStep: name } });
      stepResults[name] = { error: ref };
    }
  }

  return {
    readLogsDeleted,
    rateLimitRowsDeleted: counters.length,
    idempotencyKeysDeleted: keys.length,
    jobsDeleted: oldJobs.length,
    cronRunsDeleted: oldCronRuns.length,
    steps: stepResults,
  };
}
