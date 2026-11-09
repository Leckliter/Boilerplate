import { activityLog, cronRuns, errorEvents, getDb, isNull } from '@app/db';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  callAction,
  errorOccurrences,
  listActivity,
  listCronRuns,
  listErrors,
  resolveManyErrors,
} from '../src/actions';
import { preferencesFor, setPreference, typeDefaults } from '../src/actions/notifications';
import { reportError } from '../src/errors';
import { assertLocalDatabase, makeActor, resetDatabase } from './setup';

beforeAll(assertLocalDatabase);
beforeEach(resetDatabase);

/** Two different bugs, the first twice. */
async function someBugs() {
  const a1 = await reportError(new Error('first bug'), { source: 'job' });
  await reportError(new Error('first bug'), { source: 'job' });
  const b1 = await reportError(new TypeError('second bug, other place'), { source: 'request' });
  return { a1, b1 };
}

describe('errors.resolveMany', () => {
  it('closes every occurrence of several bugs at once and says what it did not find', async () => {
    const owner = await makeActor(['owner']);
    const { a1, b1 } = await someBugs();
    const res = await callAction(
      resolveManyErrors,
      { refs: [a1, b1, 'E-NOSUCH99'], resolution: 'Fixed in abc123' },
      owner,
    );
    expect(res).toMatchObject({
      ok: true,
      data: { resolved: 3, groups: 2, notFound: ['E-NOSUCH99'] },
    });
    expect(await getDb().select().from(errorEvents).where(isNull(errorEvents.resolvedAt))).toEqual(
      [],
    );
    expect(await callAction(listErrors, {}, owner)).toMatchObject({ ok: true, data: [] });
  });

  it('refuses when nothing matches, and for people without errors.manage', async () => {
    const owner = await makeActor(['owner']);
    expect(
      await callAction(resolveManyErrors, { refs: ['E-NOSUCH99'], resolution: 'nope' }, owner),
    ).toMatchObject({ ok: false, error: { code: 'not_found' } });
    const staff = await makeActor(['staff']);
    const { a1 } = await someBugs();
    expect(
      await callAction(resolveManyErrors, { refs: [a1], resolution: 'sneaky' }, staff),
    ).toMatchObject({ ok: false, error: { code: 'forbidden' } });
    expect(
      await getDb().select().from(errorEvents).where(isNull(errorEvents.resolvedAt)),
    ).toHaveLength(3);
  });
});

describe('errors.occurrences', () => {
  it('counts one bug per day, with zeros for quiet days, by ref or by fingerprint', async () => {
    const owner = await makeActor(['owner']);
    const { a1 } = await someBugs();
    const byRef = await callAction(errorOccurrences, { ref: a1, days: 7 }, owner);
    expect(byRef.ok ? null : byRef.error).toBeNull();
    if (!byRef.ok) return;
    expect(byRef.data.days).toHaveLength(7);
    expect(byRef.data.total).toBe(2);
    expect(byRef.data.days.at(-1)!.count).toBe(2); // both happened today
    expect(byRef.data.days.slice(0, -1).every((d) => d.count === 0)).toBe(true);

    const byFingerprint = await callAction(
      errorOccurrences,
      { fingerprint: byRef.data.fingerprint },
      owner,
    );
    expect(byFingerprint).toMatchObject({ ok: true, data: { total: 2 } });
    if (byFingerprint.ok) expect(byFingerprint.data.days).toHaveLength(14);
  });

  it('refuses a missing target, an unknown ref, both at once, and non-managers', async () => {
    const owner = await makeActor(['owner']);
    expect(await callAction(errorOccurrences, {}, owner)).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
    expect(await callAction(errorOccurrences, { ref: 'E-NOSUCH99' }, owner)).toMatchObject({
      ok: false,
      error: { code: 'not_found' },
    });
    const { a1 } = await someBugs();
    expect(
      await callAction(errorOccurrences, { ref: a1, fingerprint: 'abcdef' }, owner),
    ).toMatchObject({ ok: false, error: { code: 'invalid_input' } });
    expect(
      await callAction(errorOccurrences, { ref: a1 }, await makeActor(['staff'])),
    ).toMatchObject({ ok: false, error: { code: 'forbidden' } });
  });
});

describe('system.cronRuns', () => {
  it('lists runs newest first, filtered by job, with durations', async () => {
    const owner = await makeActor(['owner']);
    const t = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000);
    await getDb()
      .insert(cronRuns)
      .values([
        { job: 'jobs', startedAt: t(30), finishedAt: t(30), ok: true },
        {
          job: 'jobs',
          startedAt: t(20),
          finishedAt: new Date(t(20).getTime() + 1500),
          ok: false,
          error: 'boom',
        },
        { job: 'maintenance', startedAt: t(10), finishedAt: t(10), ok: true },
        { job: 'maintenance', startedAt: t(1) },
      ]);
    const all = await callAction(listCronRuns, {}, owner);
    expect(all.ok && all.data.map((r) => r.job)).toEqual([
      'maintenance',
      'maintenance',
      'jobs',
      'jobs',
    ]);
    const jobs = await callAction(listCronRuns, { job: 'jobs', limit: 5 }, owner);
    expect(jobs.ok && jobs.data.map((r) => [r.ok, r.durationMs, r.error])).toEqual([
      [false, 1500, 'boom'],
      [true, 0, null],
    ]);
    const running = await callAction(listCronRuns, { job: 'maintenance', limit: 1 }, owner);
    expect(running.ok && running.data[0]).toMatchObject({ finishedAt: null, durationMs: null });
  });

  it('is for system.manage only', async () => {
    expect(await callAction(listCronRuns, {}, await makeActor(['staff']))).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
  });
});

describe('activity.list from / to', () => {
  it('only returns entries inside the period (inclusive)', async () => {
    const owner = await makeActor(['owner']);
    const day = (n: number) => new Date(Date.UTC(2026, 0, n, 12));
    await getDb()
      .insert(activityLog)
      .values(
        [1, 2, 3, 4].map((n) => ({
          action: `test.day${n}`,
          kind: 'change' as const,
          occurredAt: day(n),
          actorKind: 'system' as const,
          channel: 'system' as const,
          ok: true,
        })),
      );
    const res = await callAction(
      listActivity,
      { from: day(2).toISOString(), to: day(3).toISOString() },
      owner,
    );
    expect(res.ok && res.data.map((e) => e.action).sort()).toEqual(['test.day2', 'test.day3']);
    const open = await callAction(listActivity, { from: day(4).toISOString() }, owner);
    expect(open.ok && open.data.some((e) => e.action === 'test.day4')).toBe(true);
    expect(open.ok && open.data.some((e) => e.action === 'test.day3')).toBe(false);
    expect(await callAction(listActivity, { from: 'yesterday' }, owner)).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
  });
});

describe('notifications.typeDefaults and notifications.preferencesFor', () => {
  it('lists every type with its channel defaults, optionally by audience', async () => {
    const manager = await makeActor(['manager']);
    const all = await callAction(typeDefaults, {}, manager);
    expect(all.ok).toBe(true);
    if (!all.ok) return;
    const welcome = all.data.find((t) => t.key === 'account.message');
    expect(welcome).toMatchObject({ audience: 'customer', defaults: { email: true } });
    const staffOnly = await callAction(typeDefaults, { audience: 'staff' }, manager);
    expect(
      staffOnly.ok && staffOnly.data.every((t) => t.audience === 'staff' && t.permission),
    ).toBe(true);
    expect(staffOnly.ok && staffOnly.data.length).toBeGreaterThan(0);
  });

  it('shows how someone else can be reached, read-only, as they would see it', async () => {
    const manager = await makeActor(['manager']);
    const customer = await makeActor([]);
    const staff = await makeActor(['staff']);
    await callAction(
      setPreference,
      { type: 'account.message', channel: 'email', enabled: false },
      customer,
    );

    const view = await callAction(preferencesFor, { contactId: customer.contactId! }, manager);
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    const row = view.data.types.find((t) => t.key === 'account.message');
    expect(row?.channels.email.enabled).toBe(false);
    // A customer is not shown staff alerts; a staff member with errors.manage-style permission is.
    expect(view.data.types.some((t) => t.audience === 'staff')).toBe(false);
    const staffView = await callAction(preferencesFor, { contactId: staff.contactId! }, manager);
    expect(staffView.ok && staffView.data.types.some((t) => t.audience === 'staff')).toBe(true);
    expect(view.data).toHaveProperty('sms');
    expect(view.data).toHaveProperty('devices');
  });

  it('refuses people without notifications.manage, and an unknown contact', async () => {
    const customer = await makeActor([]);
    expect(await callAction(typeDefaults, {}, customer)).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(
      await callAction(
        preferencesFor,
        { contactId: customer.contactId! },
        await makeActor(['staff']),
      ),
    ).toMatchObject({ ok: false, error: { code: 'forbidden' } });
    expect(
      await callAction(
        preferencesFor,
        { contactId: crypto.randomUUID() },
        await makeActor(['manager']),
      ),
    ).toMatchObject({ ok: false, error: { code: 'not_found' } });
  });
});
