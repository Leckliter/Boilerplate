import { and, desc, eq, inArray, jobs } from '@app/db';
import { z } from 'zod';

import { cronHealth, healthReport, queueStats } from '../../health';
import { listJobTypes } from '../../jobs';
import { ActionError, defineAction } from '../define';

const statusField = z.enum(['pending', 'running', 'done', 'failed', 'cancelled']);

export const systemHealth = defineAction({
  name: 'system.health',
  title: 'System health',
  description:
    'Is everything running? Database, the scheduled crons (last run, last error, stale or not), the ' +
    'background-job queue sizes by status, and the registered job types.',
  audience: 'system.manage',
  mutates: false,
  returns: '{ ok, environment, commit, checks, crons, queues, jobTypes }',
  input: z.object({}),
  async run({ tx }) {
    const now = new Date();
    const [report, crons, queues] = await Promise.all([
      healthReport(now, tx),
      cronHealth(tx, now),
      queueStats(tx),
    ]);
    return {
      ...report,
      crons,
      queues,
      jobTypes: listJobTypes().map((j) => ({ type: j.type, description: j.description })),
    };
  },
});

export const listJobs = defineAction({
  name: 'jobs.list',
  title: 'List background jobs',
  description:
    'Background jobs, newest first: type, status, attempts, when it runs next, the last error and (for ' +
    'failed jobs) the error reference for errors.get. Filter by status and type.',
  audience: 'system.manage',
  mutates: false,
  returns:
    '[{ id, type, status, attempts, maxAttempts, runAt, lastError, errorRef, result, payload, createdAt, finishedAt }]',
  input: z.object({
    status: z.array(statusField).optional().describe('Only these statuses (default: all).'),
    type: z.string().optional(),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  async run({ input, tx }) {
    return tx
      .select({
        id: jobs.id,
        type: jobs.type,
        status: jobs.status,
        attempts: jobs.attempts,
        maxAttempts: jobs.maxAttempts,
        runAt: jobs.runAt,
        lastError: jobs.lastError,
        errorRef: jobs.errorRef,
        result: jobs.result,
        payload: jobs.payload,
        createdAt: jobs.createdAt,
        finishedAt: jobs.finishedAt,
      })
      .from(jobs)
      .where(
        and(
          input.status?.length ? inArray(jobs.status, input.status) : undefined,
          input.type ? eq(jobs.type, input.type) : undefined,
        ),
      )
      .orderBy(desc(jobs.createdAt))
      .limit(input.limit);
  },
});

export const retryJob = defineAction({
  name: 'jobs.retry',
  title: 'Retry a job',
  description:
    'Run a failed or cancelled job again now, with a fresh set of attempts. Fix the cause first (see its ' +
    'errorRef) or it will just fail again.',
  audience: 'system.manage',
  mutates: true,
  returns: '{ id, status }',
  input: z.object({ id: z.uuid() }),
  async run({ input, tx, log }) {
    const [job] = await tx.select().from(jobs).where(eq(jobs.id, input.id));
    if (!job) throw new ActionError('not_found', 'Job not found.');
    if (job.status !== 'failed' && job.status !== 'cancelled') {
      throw new ActionError(
        'conflict',
        `That job is ${job.status}; only failed or cancelled jobs can be retried.`,
      );
    }
    await tx
      .update(jobs)
      .set({ status: 'pending', attempts: 0, runAt: new Date(), finishedAt: null })
      .where(eq(jobs.id, job.id));
    log({ subjectType: 'job', subjectId: job.id, summary: `Retrying job ${job.type}` });
    return { id: job.id, status: 'pending' as const };
  },
});

export const cancelJob = defineAction({
  name: 'jobs.cancel',
  title: 'Cancel a job',
  description: 'Stop a waiting (pending) job from running.',
  audience: 'system.manage',
  mutates: true,
  destructive: true,
  returns: '{ id, status }',
  input: z.object({ id: z.uuid() }),
  async run({ input, tx, log }) {
    const [job] = await tx
      .update(jobs)
      .set({ status: 'cancelled', finishedAt: new Date() })
      .where(and(eq(jobs.id, input.id), eq(jobs.status, 'pending')))
      .returning();
    if (!job) throw new ActionError('conflict', 'Only a waiting (pending) job can be cancelled.');
    log({ subjectType: 'job', subjectId: job.id, summary: `Cancelled job ${job.type}` });
    return { id: job.id, status: job.status };
  },
});
