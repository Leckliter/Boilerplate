import type { Job } from '@app/db';
import type { z } from 'zod';

/**
 * A JOB is work done in the background: after the request, at a set time, or
 * retried until it succeeds (e.g. delete a file from storage, call an outside API
 * with retries). See docs/jobs.md.
 *
 * - Queue it with `enqueue(tx, 'files.deleteObject', { … })` inside an action:
 *   it is saved in the same transaction, so it exists only if the change does.
 * - The runner retries a failing job with backoff, up to `maxAttempts`, then
 *   files an error report (staff are alerted like any new bug).
 * - A job that changes business data calls the ACTION for it with
 *   `systemActor()` — the same rules and activity log as everything else.
 * - Jobs can run more than once (a server dies mid-run), so make `run` safe to
 *   repeat: check before doing, use idempotency keys with outside services.
 *
 * Naming: `<area>.<verb>` like actions, e.g. `files.deleteObject`.
 */
export type JobDefinition<S extends z.ZodType = z.ZodType> = {
  type: `${string}.${string}`;
  /** What it does, for the jobs screen and docs. */
  description: string;
  payload: S;
  /** Tries before giving up (default 5). */
  maxAttempts?: number;
  /** Returns a small JSON-able summary shown on the jobs screen. */
  run: (payload: z.output<S>, ctx: { job: Job }) => Promise<unknown>;
};

export type AnyJob = JobDefinition<z.ZodType>;

export function defineJob<S extends z.ZodType>(def: JobDefinition<S>) {
  return def;
}

/** Throw from a job for a failure that retrying won't fix: it fails at once, without retries. */
export class PermanentJobError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PermanentJobError';
  }
}
