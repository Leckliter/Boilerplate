import { and, eq, getDb, inArray, type Job, jobs, sql } from '@app/db';

import { reportError } from '../errors/report';
import { PermanentJobError } from './define';
import { getJob } from './registry';

/** Wait this long before attempt 2, 3, 4 …; the last delay repeats. */
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 6 * 60 * 60_000];
/** A job stuck in `running` this long (its server died) is picked up again. */
const STUCK_MS = 15 * 60_000;

export type RunJobsResult = { done: number; retrying: number; failed: number };

/**
 * Run every job that is due — including ones queued while running — until there are
 * none or `deadlineMs` has passed.
 * Safe to call from many places at once: each job is claimed with SKIP LOCKED.
 * Called after every request that changed data, and every minute by cron.
 */
export async function runDueJobs(
  opts: { limit?: number; deadlineMs?: number; now?: () => Date } = {},
): Promise<RunJobsResult> {
  const now = opts.now ?? (() => new Date());
  const started = Date.now();
  const result: RunJobsResult = { done: 0, retrying: 0, failed: 0 };
  for (;;) {
    const batch = await claim(opts.limit ?? 10, now());
    for (const job of batch) {
      const outcome = await runOne(job, now());
      result[outcome]++;
    }
    // Keep going while there is work: a job often queues the next one (an event's dispatch
    // starts automation runs), and that should happen now, not at the next cron minute.
    if (batch.length === 0 || Date.now() - started > (opts.deadlineMs ?? 30_000)) {
      return result;
    }
  }
}

async function claim(limit: number, now: Date): Promise<Job[]> {
  const stuck = new Date(now.getTime() - STUCK_MS);
  const rows = await getDb().execute<{ id: string }>(sql`
    update app.jobs
    set status = 'running', attempts = attempts + 1,
        started_at = ${now.toISOString()}::timestamptz, updated_at = ${now.toISOString()}::timestamptz
    where id in (
      select id from app.jobs
      where (status = 'pending' and run_at <= ${now.toISOString()}::timestamptz)
         or (status = 'running' and started_at < ${stuck.toISOString()}::timestamptz)
      order by run_at
      limit ${limit}
      for update skip locked
    )
    returning id`);
  const ids = [...rows].map((r) => r.id);
  if (!ids.length) return [];
  return getDb().select().from(jobs).where(inArray(jobs.id, ids));
}

async function runOne(job: Job, now: Date): Promise<keyof RunJobsResult> {
  const definition = getJob(job.type);
  try {
    if (!definition) throw new PermanentJobError(`Unknown job type "${job.type}"`);
    const payload = definition.payload.parse(job.payload);
    const value = await definition.run(payload, { job });
    await settle(job.id, {
      status: 'done',
      result: summarise(value),
      lastError: null,
      finishedAt: new Date(),
    });
    return 'done';
  } catch (err) {
    const message = String((err as Error)?.message ?? err).slice(0, 2_000);
    const permanent = err instanceof PermanentJobError;
    if (!permanent && job.attempts < job.maxAttempts) {
      const delay = BACKOFF_MS[Math.min(job.attempts - 1, BACKOFF_MS.length - 1)]!;
      await settle(job.id, {
        status: 'pending',
        lastError: message,
        runAt: new Date(now.getTime() + delay),
      });
      return 'retrying';
    }
    // Out of tries: it's a bug or an outage someone has to look at.
    const ref = await reportError(err, {
      source: 'job',
      action: job.type,
      input: job.payload,
      context: { job: job.type, jobId: job.id, attempts: job.attempts },
    });
    await settle(job.id, {
      status: 'failed',
      lastError: message,
      errorRef: ref,
      finishedAt: new Date(),
    });
    return 'failed';
  }
}

async function settle(id: string, set: Partial<typeof jobs.$inferInsert>) {
  await getDb()
    .update(jobs)
    .set(set)
    .where(and(eq(jobs.id, id), eq(jobs.status, 'running')));
}

/** Keep what's shown on the jobs screen small. */
function summarise(value: unknown): unknown {
  if (value === undefined) return null;
  try {
    const json = JSON.stringify(value);
    return json.length > 4_000 ? { note: 'result too large to keep', size: json.length } : value;
  } catch {
    // Expected: a job may return something JSON can't hold (cycles, BigInt).
    return { note: 'result is not JSON' };
  }
}
