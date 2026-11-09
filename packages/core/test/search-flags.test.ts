import { eq, getDb, notifications, settings } from '@app/db';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { guestActor } from '../src/access';
import { callAction, createContact } from '../src/actions';
import { listFlags, setFeatureFlag } from '../src/actions/flags';
import { markAllRead, recentNotifications, listNotifications } from '../src/actions/notifications';
import { search } from '../src/actions/search';
import { clearFlagCache, evaluateFlag, isEnabled, rolloutBucket } from '../src/flags';
import { reportError } from '../src/errors';
import { assertLocalDatabase, makeActor, resetDatabase } from './setup';

beforeAll(assertLocalDatabase);
beforeEach(async () => {
  await resetDatabase();
  clearFlagCache();
});

const ok = async <T>(p: Promise<{ ok: boolean }>) => {
  const r = (await p) as { ok: boolean; data?: T; error?: unknown };
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.data as T;
};
type Hit = { type: string; id: string; title: string; subtitle: string | null; href: string };

describe('search.query', () => {
  async function world() {
    const owner = await makeActor(['owner'], 'Olivia Owner');
    await ok(
      callAction(
        createContact,
        {
          firstName: 'Zelda',
          lastName: 'Zebra',
          email: 'zelda@example.com',
          phone: '816-555-0142',
        },
        owner,
      ),
    );
    const [report] = [await reportError(new Error('zebra crossing broke'), { source: 'request' })];
    return { owner, ref: report };
  }

  it('finds contacts by name, email and phone with a link to open each', async () => {
    const { owner } = await world();
    for (const q of ['zeb', 'zelda@', '555-0142', '0142']) {
      const { results } = await ok<{ results: Hit[] }>(callAction(search, { q }, owner));
      const hit = results.find((r) => r.type === 'contact');
      expect(hit, q).toMatchObject({ title: 'Zelda Zebra', subtitle: 'zelda@example.com' });
      expect(hit!.href).toBe(`/admin/users/${hit!.id}`);
    }
  });

  it('finds tags, docs and activity summaries; error reports only by reference', async () => {
    const { owner, ref } = await world();
    const customerTag = await ok<{ results: Hit[] }>(callAction(search, { q: 'customer' }, owner));
    expect(customerTag.results.find((r) => r.type === 'tag')).toMatchObject({
      id: 'customer',
      href: '/admin/users?tag=customer',
    });
    const docs = await ok<{ results: Hit[] }>(callAction(search, { q: 'started' }, owner));
    expect(docs.results.some((r) => r.type === 'doc' && r.href.startsWith('/docs/'))).toBe(true);
    const activity = await ok<{ results: Hit[] }>(
      callAction(search, { q: 'Created Zelda' }, owner),
    );
    expect(activity.results.find((r) => r.type === 'activity')).toMatchObject({
      title: 'Created Zelda Zebra',
    });
    expect(activity.results.find((r) => r.type === 'activity')!.href).toMatch(
      /^\/admin\/activity\//,
    );
    const byRef = await ok<{ results: Hit[] }>(
      callAction(search, { q: ref!.toLowerCase() }, owner),
    );
    expect(byRef.results.find((r) => r.type === 'error')).toMatchObject({
      id: ref,
      href: `/admin/errors/${ref}`,
    });
    // The message text alone does not search error reports.
    const byText = await ok<{ results: Hit[] }>(callAction(search, { q: 'crossing' }, owner));
    expect(byText.results.some((r) => r.type === 'error')).toBe(false);
  });

  it('only returns what the caller may see: staff no errors/activity; customers docs only', async () => {
    const { ref } = await world();
    const staff = await makeActor(['staff']);
    const customer = await makeActor([]);
    const asStaff = await ok<{ results: Hit[] }>(callAction(search, { q: ref! }, staff));
    expect(asStaff.results.some((r) => r.type === 'error')).toBe(false);
    expect(
      (
        await ok<{ results: Hit[] }>(callAction(search, { q: 'Created Zelda' }, staff))
      ).results.some((r) => r.type === 'activity'),
    ).toBe(false);
    expect(
      (await ok<{ results: Hit[] }>(callAction(search, { q: 'zelda' }, staff))).results.some(
        (r) => r.type === 'contact',
      ),
    ).toBe(true);
    const asCustomer = await ok<{ results: Hit[] }>(callAction(search, { q: 'zebra' }, customer));
    expect(asCustomer.results).toEqual([]);
    const customerDocs = await ok<{ results: Hit[] }>(
      callAction(search, { q: 'started' }, customer),
    );
    expect(customerDocs.results.length).toBeGreaterThan(0);
    expect(customerDocs.results.every((r) => r.type === 'doc')).toBe(true);
  });

  it('respects limit, escapes wildcards, and refuses signed-out visitors', async () => {
    const { owner } = await world();
    for (const n of [1, 2, 3, 4, 5])
      await ok(callAction(createContact, { firstName: 'Mass', lastName: `Match${n}` }, owner));
    const limited = await ok<{ results: Hit[] }>(
      callAction(search, { q: 'mass', limit: 2 }, owner),
    );
    expect(limited.results).toHaveLength(2);
    const percent = await ok<{ results: Hit[] }>(callAction(search, { q: '%' }, owner));
    expect(percent.results.filter((r) => r.type === 'contact')).toEqual([]);
    expect(await callAction(search, { q: 'zebra' }, guestActor())).toMatchObject({
      ok: false,
      error: { code: 'unauthenticated' },
    });
  });
});

describe('feature flags', () => {
  const who = (id: string, roles: string[] = []) => ({ contactId: id, roles: roles as never });

  it('evaluates: kill switch, role / contact allow-lists, percent rollout, everyone', () => {
    const a = crypto.randomUUID();
    expect(evaluateFlag('f', { enabled: false, roles: ['owner'] }, who(a, ['owner']))).toBe(false);
    expect(evaluateFlag('f', { enabled: true }, null)).toBe(true);
    expect(evaluateFlag('f', { enabled: true, roles: ['admin'] }, who(a, ['admin']))).toBe(true);
    expect(evaluateFlag('f', { enabled: true, roles: ['admin'] }, who(a, ['staff']))).toBe(false);
    expect(evaluateFlag('f', { enabled: true, contactIds: [a] }, who(a))).toBe(true);
    expect(evaluateFlag('f', { enabled: true, percent: 0 }, who(a))).toBe(false);
    expect(evaluateFlag('f', { enabled: true, percent: 100 }, null)).toBe(true);
    expect(evaluateFlag('f', { enabled: true, percent: 50 }, null)).toBe(false);
    // percent AND roles: a role match wins, the rest follow the percentage
    expect(
      evaluateFlag('f', { enabled: true, percent: 0, roles: ['owner'] }, who(a, ['owner'])),
    ).toBe(true);
  });

  it('percent rollout is stable per person and only ever grows', () => {
    const ids = Array.from({ length: 400 }, () => crypto.randomUUID());
    const on = (pct: number) =>
      ids.filter((id) => evaluateFlag('rollout', { enabled: true, percent: pct }, who(id)));
    const at30 = on(30);
    expect(at30).toEqual(on(30));
    const at60 = new Set(on(60));
    expect(at30.every((id) => at60.has(id))).toBe(true);
    expect(at30.length).toBeGreaterThan(80);
    expect(at30.length).toBeLessThan(160);
    expect(rolloutBucket('x', ids[0]!)).toBe(rolloutBucket('x', ids[0]!));
  });

  it('isEnabled reads the stored setting, falling back to the flag default', async () => {
    const admin = await makeActor(['admin']);
    expect(await isEnabled('holiday-banner')).toBe(false); // default off
    await ok(callAction(setFeatureFlag, { name: 'holiday-banner', enabled: true }, admin));
    expect(await isEnabled('holiday-banner')).toBe(true);
    await ok(
      callAction(setFeatureFlag, { name: 'new-checkout', enabled: true, roles: ['owner'] }, admin),
    );
    expect(await isEnabled('new-checkout', admin)).toBe(false);
    const owner = await makeActor(['owner']);
    expect(await isEnabled('new-checkout', owner)).toBe(true);
    const stored = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, 'flags.new-checkout'));
    expect(stored[0]!.value).toEqual({ enabled: true, roles: ['owner'] });
  });

  it('flags.list shows every known flag; set merges fields and null clears them', async () => {
    const manager = await makeActor(['manager']);
    const before = await ok<{ name: string; configured: boolean; enabled: boolean }[]>(
      callAction(listFlags, {}, manager),
    );
    expect(before.map((f) => f.name)).toEqual(
      expect.arrayContaining(['beta-dashboard', 'new-checkout', 'holiday-banner']),
    );
    expect(before.every((f) => !f.configured)).toBe(true);
    await ok(
      callAction(
        setFeatureFlag,
        { name: 'beta-dashboard', enabled: true, percent: 25, roles: ['owner'] },
        manager,
      ),
    );
    await ok(callAction(setFeatureFlag, { name: 'beta-dashboard', percent: 50 }, manager));
    let flag = (
      await ok<{ name: string; percent?: number; roles?: string[]; enabled: boolean }[]>(
        callAction(listFlags, {}, manager),
      )
    ).find((f) => f.name === 'beta-dashboard')!;
    expect(flag).toMatchObject({ enabled: true, percent: 50, roles: ['owner'] });
    await ok(
      callAction(setFeatureFlag, { name: 'beta-dashboard', percent: null, roles: null }, manager),
    );
    flag = (
      await ok<{ name: string; percent?: number; roles?: string[]; enabled: boolean }[]>(
        callAction(listFlags, {}, manager),
      )
    ).find((f) => f.name === 'beta-dashboard')!;
    expect(flag.percent).toBeUndefined();
    expect(flag.roles).toBeUndefined();
    expect(
      await callAction(setFeatureFlag, { name: 'made-up' as never, enabled: true }, manager),
    ).toMatchObject({ ok: false, error: { code: 'invalid_input' } });
  });

  it('is refused to staff, customers and visitors', async () => {
    for (const actor of [await makeActor(['staff']), await makeActor([])]) {
      expect(await callAction(listFlags, {}, actor)).toMatchObject({
        ok: false,
        error: { code: 'forbidden' },
      });
      expect(
        await callAction(setFeatureFlag, { name: 'new-checkout', enabled: true }, actor),
      ).toMatchObject({ ok: false, error: { code: 'forbidden' } });
    }
    expect(await callAction(listFlags, {}, guestActor())).toMatchObject({
      ok: false,
      error: { code: 'unauthenticated' },
    });
  });
});

describe('notification bell: recent + markAllRead', () => {
  async function give(contactId: string, n: number) {
    const rows = Array.from({ length: n }, (_, i) => ({
      contactId,
      type: 'account.message',
      content: {
        title: `Item ${i}`,
        body: 'b',
        url: i % 2 ? `/account/things/${i}` : undefined,
        emailSubject: 's',
        sms: 's',
      },
      createdAt: new Date(Date.now() - (n - i) * 60_000),
    }));
    await getDb().insert(notifications).values(rows);
  }

  it('recent returns the newest items with their href and the unread count', async () => {
    const me = await makeActor([]);
    await give(me.contactId!, 10);
    const r = await ok<{ items: { title: string; href: string | null }[]; unread: number }>(
      callAction(recentNotifications, { limit: 3 }, me),
    );
    expect(r.items.map((i) => i.title)).toEqual(['Item 9', 'Item 8', 'Item 7']);
    expect(r.items[0]!.href).toBe('/account/things/9');
    expect(r.items[1]!.href).toBeNull();
    expect(r.unread).toBe(10);
    const other = await makeActor([]);
    expect(
      (await ok<{ items: unknown[] }>(callAction(recentNotifications, {}, other))).items,
    ).toEqual([]);
  });

  it('markAllRead clears the unread count only for the caller', async () => {
    const me = await makeActor([]);
    const other = await makeActor([]);
    await give(me.contactId!, 4);
    await give(other.contactId!, 2);
    expect(await ok(callAction(markAllRead, {}, me))).toEqual({ updated: 4, unread: 0 });
    expect((await ok<{ unread: number }>(callAction(listNotifications, {}, me))).unread).toBe(0);
    expect((await ok<{ unread: number }>(callAction(listNotifications, {}, other))).unread).toBe(2);
    expect(await ok(callAction(markAllRead, {}, me))).toEqual({ updated: 0, unread: 0 });
  });

  it('are refused to signed-out visitors', async () => {
    expect(await callAction(recentNotifications, {}, guestActor())).toMatchObject({
      ok: false,
      error: { code: 'unauthenticated' },
    });
    expect(await callAction(markAllRead, {}, guestActor())).toMatchObject({
      ok: false,
      error: { code: 'unauthenticated' },
    });
  });
});
