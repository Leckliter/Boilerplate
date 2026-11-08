import { activityLog, eq, getDb, idempotencyKeys, rateLimitHits, settings } from '@app/db';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { guestActor, userActor, withRequest } from '../src/access';
import { callAction, defineAction } from '../src/actions';
import { takeRateLimit } from '../src/rate-limit';
import { runMaintenance } from '../src/maintenance';
import { assertLocalDatabase, makeActor, resetDatabase } from './setup';

beforeAll(assertLocalDatabase);
beforeEach(resetDatabase);

let runs = 0;
const limited = defineAction({
  name: 'test.limited',
  title: 'Limited',
  description: 'A public action with a rate limit.',
  audience: 'public',
  rateLimit: { limit: 2, perSeconds: 600 },
  mutates: true,
  returns: 'count',
  input: z.object({ v: z.string().default('x') }),
  async run({ input, tx }) {
    runs++;
    await tx.insert(settings).values({ key: `t.${runs}`, value: input.v });
    return { runs };
  },
});

/** Same, without the limit (replays count against a limit too). */
const counted = defineAction({
  ...limited,
  name: 'test.counted',
  rateLimit: undefined,
  audience: 'system.manage',
});

describe('rate limits', () => {
  it('counts per guest IP, then refuses with rate_limited; other callers are unaffected', async () => {
    const a = withRequest(guestActor(), { id: 'r1', ip: '203.0.113.1' });
    const b = withRequest(guestActor(), { id: 'r2', ip: '203.0.113.2' });
    expect((await callAction(limited, {}, a)).ok).toBe(true);
    expect((await callAction(limited, {}, a)).ok).toBe(true);
    const third = await callAction(limited, {}, a);
    expect(third).toMatchObject({ ok: false, error: { code: 'rate_limited' } });
    expect(
      !third.ok && (third.error.details as { retryAfterSeconds: number }).retryAfterSeconds,
    ).toBeGreaterThan(0);
    expect((await callAction(limited, {}, b)).ok).toBe(true);
  });

  it('takeRateLimit windows reset', async () => {
    const t0 = new Date('2026-01-01T00:00:00Z');
    expect(await takeRateLimit('k', { limit: 1, perSeconds: 60 }, t0)).toEqual({ allowed: true });
    expect(await takeRateLimit('k', { limit: 1, perSeconds: 60 }, t0)).toMatchObject({
      allowed: false,
    });
    expect(
      await takeRateLimit('k', { limit: 1, perSeconds: 60 }, new Date(t0.getTime() + 61_000)),
    ).toEqual({ allowed: true });
  });
});

describe('idempotency keys', () => {
  it('the same key returns the first result without doing the change again', async () => {
    runs = 0;
    const owner = await makeActor(['owner']);
    const actor = withRequest(
      userActor({ contactId: owner.contactId!, roles: ['owner'], channel: 'api' }),
      {
        id: 'i1',
        idempotencyKey: 'key-1',
      },
    );
    const first = await callAction(counted, { v: 'a' }, actor);
    const again = await callAction(counted, { v: 'a' }, actor);
    expect(first).toMatchObject({ ok: true, data: { runs: 1 } });
    expect(again).toMatchObject({ ok: true, data: { runs: 1 }, replayed: true });
    expect(runs).toBe(1);
    // Same key, different input → conflict.
    expect(await callAction(counted, { v: 'b' }, actor)).toMatchObject({
      ok: false,
      error: { code: 'conflict' },
    });
    // Malformed key.
    const bad = withRequest(actor, { id: 'i2', idempotencyKey: 'has space' });
    expect(await callAction(counted, {}, bad)).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
  });
});

describe('maintenance', () => {
  it('deletes old API reads, rate-limit counters and expired idempotency keys but keeps changes', async () => {
    const old = new Date(Date.now() - 400 * 86_400_000);
    const base = { actorKind: 'system', channel: 'api', ok: true, occurredAt: old } as const;
    await getDb()
      .insert(activityLog)
      .values([
        { ...base, kind: 'read', action: 'contacts.list' },
        { ...base, kind: 'change', action: 'contacts.create' },
      ]);
    await getDb().insert(rateLimitHits).values({ key: 'x', windowStart: old, hits: 1 });
    await getDb().insert(idempotencyKeys).values({
      caller: 'c',
      key: 'k',
      action: 'a',
      requestHash: 'h',
      createdAt: old,
    });
    const res = await runMaintenance();
    expect(res).toMatchObject({
      readLogsDeleted: 1,
      rateLimitRowsDeleted: 1,
      idempotencyKeysDeleted: 1,
    });
    const left = await getDb()
      .select()
      .from(activityLog)
      .where(eq(activityLog.action, 'contacts.create'));
    expect(left).toHaveLength(1);
  });

  it('is callable only as system code (not an action) and wrapped by recordCronRun', async () => {
    const { recordCronRun, cronHealth } = await import('../src/health');
    const out = await recordCronRun('maintenance', () => runMaintenance());
    expect(out.readLogsDeleted).toBe(0);
    const health = (await cronHealth()).find((c) => c.job === 'maintenance');
    expect(health).toMatchObject({ stale: false, lastError: null });
    expect(health?.lastOkAt).toBeInstanceOf(Date);
    await expect(
      recordCronRun('maintenance', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect((await cronHealth()).find((c) => c.job === 'maintenance')?.lastError).toContain('boom');
  });
});
