import { eq, errorEvents, getDb, jobs } from '@app/db';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  callAction,
  cancelJob,
  defineAction,
  listJobs,
  retryJob,
  runAction,
  systemHealth,
} from '../src/actions';
import {
  defineJob,
  enqueue,
  PermanentJobError,
  registerJobForTests,
  runDueJobs,
} from '../src/jobs';
import { assertLocalDatabase, makeActor, resetDatabase } from './setup';

beforeAll(assertLocalDatabase);
beforeEach(resetDatabase);

const done: string[] = [];
registerJobForTests(
  defineJob({
    type: 'test.ok',
    description: 'Records its payload.',
    payload: z.object({ n: z.number() }),
    async run({ n }) {
      done.push(`ok:${n}`);
      return { n };
    },
  }),
);
registerJobForTests(
  defineJob({
    type: 'test.flaky',
    description: 'Always throws.',
    payload: z.object({}),
    maxAttempts: 2,
    async run() {
      throw new Error('flaky failure');
    },
  }),
);
registerJobForTests(
  defineJob({
    type: 'test.permanent',
    description: 'Fails without retries.',
    payload: z.object({}),
    async run() {
      throw new PermanentJobError('never works');
    },
  }),
);

/** An action that queues a job inside its transaction, then fails or not. */
const queuer = defineAction({
  name: 'test.queue',
  title: 'Queue',
  description: 'Queues a job.',
  audience: 'system.manage',
  mutates: true,
  returns: 'nothing',
  input: z.object({ fail: z.boolean().default(false) }),
  async run({ input, tx }) {
    await enqueue(tx, 'test.ok', { n: 7 }, { dedupeKey: 'seven' });
    await enqueue(tx, 'test.ok', { n: 7 }, { dedupeKey: 'seven' });
    if (input.fail) throw new Error('rolled back');
  },
});

describe('background jobs', () => {
  it('a queued job runs once, and only exists if the action committed; dedupeKey queues it once', async () => {
    const owner = await makeActor(['owner']);
    done.length = 0;
    // (A failed action also files an error report, which the events module turns into an
    // `events.dispatch` job — so look only at this test's own jobs.)
    const mine = async () =>
      (await getDb().select().from(jobs)).filter((j) => j.type.startsWith('test.'));
    await callAction(queuer, { fail: true }, owner);
    expect(await mine()).toHaveLength(0);
    await callAction(queuer, {}, owner);
    expect(await mine()).toHaveLength(1);
    expect(await runDueJobs()).toMatchObject({ retrying: 0, failed: 0 });
    expect(done).toEqual(['ok:7']);
    const [job] = await getDb().select().from(jobs).where(eq(jobs.type, 'test.ok'));
    expect(job).toMatchObject({ status: 'done', attempts: 1, result: { n: 7 } });
    expect(job?.activityId).toBeTruthy(); // linked to the action that queued it
  });

  it('retries with backoff, then fails with an error report; permanent errors fail at once', async () => {
    await getDb().transaction(async (tx) => {
      await enqueue(tx, 'test.flaky', {});
      await enqueue(tx, 'test.permanent', {});
    });
    const first = await runDueJobs();
    expect(first).toMatchObject({ retrying: 1, failed: 1 });
    const flaky = (await getDb().select().from(jobs).where(eq(jobs.type, 'test.flaky')))[0]!;
    expect(flaky).toMatchObject({ status: 'pending', attempts: 1, lastError: 'flaky failure' });
    expect(flaky.runAt.getTime()).toBeGreaterThan(Date.now());
    await getDb().update(jobs).set({ runAt: new Date() }).where(eq(jobs.id, flaky.id));
    expect(await runDueJobs()).toMatchObject({ retrying: 0, failed: 1 });
    const failed = (await getDb().select().from(jobs).where(eq(jobs.type, 'test.flaky')))[0]!;
    expect(failed.status).toBe('failed');
    expect(failed.errorRef).toMatch(/^E-/);
    expect(await getDb().select().from(errorEvents)).toHaveLength(2);
  });

  it('system.health, jobs.list, jobs.retry and jobs.cancel work for owners and refuse everyone else', async () => {
    const owner = await makeActor(['owner']);
    await getDb().transaction((tx) => enqueue(tx, 'test.permanent', {}));
    await runDueJobs();
    const list = await callAction(listJobs, { status: ['failed'] }, owner);
    expect(list.ok && list.data).toHaveLength(1);
    const id = list.ok ? list.data[0]!.id : '';
    expect(await callAction(retryJob, { id }, owner)).toMatchObject({
      ok: true,
      data: { status: 'pending' },
    });
    expect(await callAction(retryJob, { id }, owner)).toMatchObject({
      ok: false,
      error: { code: 'conflict' },
    });
    expect(await callAction(cancelJob, { id }, owner)).toMatchObject({
      ok: true,
      data: { status: 'cancelled' },
    });
    expect(await callAction(cancelJob, { id }, owner)).toMatchObject({
      ok: false,
      error: { code: 'conflict' },
    });
    const health = await callAction(systemHealth, {}, owner);
    expect(health).toMatchObject({
      ok: true,
      data: { ok: true, checks: { database: { ok: true } } },
    });
    expect(health.ok && health.data.queues.jobs).toMatchObject({ cancelled: 1 });

    const manager = await makeActor(['manager']);
    for (const [action, input] of [
      ['jobs.list', {}],
      ['jobs.retry', { id }],
      ['jobs.cancel', { id }],
      ['system.health', {}],
    ] as const) {
      expect(await runAction(action, input, manager)).toMatchObject({
        ok: false,
        error: { code: 'forbidden' },
      });
    }
  });
});
