import { type AnyJob } from './define';

/**
 * THE list of job types. Core has none of its own: optional modules register theirs when
 * imported (packages/core/src/modules.ts), and your app can register more:
 *
 *   registerJob(defineJob({ type: 'reports.build', description: '…', payload: z.object({…}), run }));
 *
 * then `enqueue(tx, 'reports.build', payload)` from an action. See docs/jobs.md.
 */
const byType = new Map<string, AnyJob>();

/** Register a job type. A duplicate type is a bug and throws. */
export function registerJob(job: AnyJob) {
  if (byType.has(job.type)) throw new Error(`Duplicate job type: ${job.type}`);
  byType.set(job.type, job);
}

export function getJob(type: string): AnyJob | undefined {
  return byType.get(type);
}

export function listJobTypes(): readonly AnyJob[] {
  return [...byType.values()];
}

/** Tests: register (or replace) a job type. */
export function registerJobForTests(job: AnyJob) {
  byType.set(job.type, job);
}
