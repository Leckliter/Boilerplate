import { sql } from 'drizzle-orm';
import { index, integer, jsonb, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { app, createdAt, id, updatedAt } from './_shared';

/**
 * Background jobs: work that runs after the request, on a schedule, or must be
 * retried until it succeeds. See docs/jobs.md.
 *
 * Queue one with `enqueue(tx, 'type', payload)` INSIDE an action — the job
 * exists only if the action's changes are saved. A runner claims due jobs
 * (SKIP LOCKED, so each runs once), right after the request and every minute
 * from cron, retrying with backoff. Job types: packages/core/src/jobs/registry.ts.
 */
export const jobStatus = app.enum('job_status', [
  'pending', // waiting for run_at (first try or a retry)
  'running', // claimed by a runner
  'done',
  'failed', // gave up after max attempts (an error report was filed)
  'cancelled',
]);

export const jobs = app
  .table(
    'jobs',
    {
      id: id(),
      /** The job type, e.g. `files.deleteObject`. */
      type: text('type').notNull(),
      payload: jsonb('payload').notNull().default({}),
      status: jobStatus('status').notNull().default('pending'),
      /** Not before this time (scheduled start, or retry backoff). */
      runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
      attempts: integer('attempts').notNull().default(0),
      maxAttempts: integer('max_attempts').notNull().default(5),
      /** Same type + key is only queued once while it's pending/running. */
      dedupeKey: text('dedupe_key'),
      lastError: text('last_error'),
      /** Error reference of the final failure (errors.get). */
      errorRef: text('error_ref'),
      /** What the job returned (small JSON), for the jobs screen. */
      result: jsonb('result'),
      /** The activity-log entry of the action that queued it. */
      activityId: uuid('activity_id'),
      startedAt: timestamp('started_at', { withTimezone: true }),
      finishedAt: timestamp('finished_at', { withTimezone: true }),
      createdAt: createdAt(),
      updatedAt: updatedAt(),
    },
    (t) => [
      index('jobs_due_idx').on(t.status, t.runAt),
      uniqueIndex('jobs_dedupe_key')
        .on(t.type, t.dedupeKey)
        .where(sql`${t.dedupeKey} is not null and ${t.status} in ('pending', 'running')`),
    ],
  )
  .enableRLS();

/**
 * Idempotency keys for API/AI changes (`Idempotency-Key` header, or the
 * `idempotencyKey` MCP argument): the same caller + key within 24 hours gets
 * the first call's result instead of doing the change twice. See docs/actions.md.
 */
export const idempotencyKeys = app
  .table(
    'idempotency_keys',
    {
      /** Who sent it: `key:<api key id>`, `contact:<id>` or `ip:<address>`. */
      caller: text('caller').notNull(),
      key: text('key').notNull(),
      action: text('action').notNull(),
      /** SHA-256 of the validated input — a reused key with different input is refused. */
      requestHash: text('request_hash').notNull(),
      /** The successful result, returned again on a repeat. Null while the follow-up step runs. */
      response: jsonb('response'),
      createdAt: createdAt(),
    },
    (t) => [
      uniqueIndex('idempotency_keys_caller_key').on(t.caller, t.key),
      index('idempotency_keys_created_idx').on(t.createdAt),
    ],
  )
  .enableRLS();

export type Job = typeof jobs.$inferSelect;
