import {
  and,
  contacts,
  eq,
  getDb,
  messageSuppressions,
  notificationDeliveries,
  notifications,
} from '@app/db';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { guestActor } from '../src/access';
import { callAction } from '../src/actions';
import {
  dismissNotifications,
  getPreferences,
  listDeliveries,
  listNotifications,
  markRead,
  openNotification,
  recordSuppression,
  retryDelivery,
  sendTest,
  setPreference,
  setSmsConsent,
  unreadCount,
  unsubscribe,
} from '../src/actions/notifications';
import { reportError } from '../src/errors';
import { isRecipientAllowed } from '../src/messaging';
import {
  dispatchDue,
  nextAllowedTime,
  notify,
  setSendersForTests,
  signUnsubscribe,
  type Senders,
} from '../src/notifications';
import { assertLocalDatabase, makeActor, resetDatabase } from './setup';

beforeAll(assertLocalDatabase);
beforeEach(resetDatabase);
afterEach(() => setSendersForTests(null));

async function ok<T>(p: Promise<{ ok: boolean }>): Promise<T> {
  const r = (await p) as { ok: boolean; data?: T; error?: unknown };
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.data as T;
}

/** Fake senders that record what would have gone out. */
function fakeSenders(results: Partial<{ email: unknown; sms: unknown }> = {}) {
  const sent = {
    email: [] as { to: string; subject: string }[],
    sms: [] as { to: string; content: string }[],
  };
  const senders: Senders = {
    email: async (m) => {
      sent.email.push(m);
      return (results.email as never) ?? { status: 'sent', providerId: 'e1' };
    },
    sms: async (m) => {
      sent.sms.push(m);
      return (results.sms as never) ?? { status: 'sent', providerId: 's1' };
    },
    push: async () => ({ status: 'not_configured' }),
  };
  setSendersForTests(senders);
  return sent;
}

const send = (contactId: string, over: object = {}) =>
  getDb().transaction((tx) =>
    notify(tx, 'account.message', {
      to: contactId,
      data: { title: 'Hello', body: 'World' },
      ...over,
    } as never),
  );
const deliveries = () => getDb().select().from(notificationDeliveries);

describe('notify', () => {
  it('creates the inbox item and an email delivery; dedupeKey notifies once', async () => {
    const actor = await makeActor([]);
    expect(await send(actor.contactId!, { dedupeKey: 'k' })).toBe(1);
    expect(await send(actor.contactId!, { dedupeKey: 'k' })).toBe(0);
    expect(await getDb().select().from(notifications)).toHaveLength(1);
    const d = await deliveries();
    expect(d).toMatchObject([{ channel: 'email', status: 'pending' }]);
  });

  it('never queues a text without recorded consent, and does once consent is on record', async () => {
    const actor = await makeActor([]);
    await getDb()
      .update(contacts)
      .set({ phone: '+18165550101' })
      .where(eq(contacts.id, actor.contactId!));
    await send(actor.contactId!, { dedupeKey: 'a' });
    expect((await deliveries()).map((d) => d.channel)).toEqual(['email']);
    await ok(callAction(setSmsConsent, { consent: true }, actor));
    await send(actor.contactId!, { dedupeKey: 'b' });
    expect((await deliveries()).map((d) => d.channel).sort()).toEqual(['email', 'email', 'sms']);
    const [c] = await getDb().select().from(contacts).where(eq(contacts.id, actor.contactId!));
    expect(c).toMatchObject({ smsConsentSource: 'account' });
    expect(c!.smsConsentText).toContain('STOP');
  });

  it('honours preferences, suppressions and the channels filter; staff types go to permission holders', async () => {
    const actor = await makeActor([]);
    await ok(
      callAction(
        setPreference,
        { type: 'account.message', channel: 'email', enabled: false },
        actor,
      ),
    );
    await send(actor.contactId!);
    expect(await deliveries()).toHaveLength(0);
    await ok(
      callAction(
        setPreference,
        { type: 'account.message', channel: 'email', enabled: true },
        actor,
      ),
    );
    await getDb()
      .insert(messageSuppressions)
      .values({
        channel: 'email',
        address: (
          await getDb().select().from(contacts).where(eq(contacts.id, actor.contactId!))
        )[0]!.email!,
        reason: 'bounce',
      });
    await send(actor.contactId!, { dedupeKey: 'x' });
    expect(await deliveries()).toMatchObject([{ status: 'skipped' }]);
    const owner = await makeActor(['owner']);
    await makeActor(['staff']);
    const n = await getDb().transaction((tx) =>
      notify(tx, 'staff.automationFailed', {
        to: { permission: 'automations.manage' },
        data: { automationId: 'a', automationName: 'N', runId: 'r', error: 'e' },
      }),
    );
    expect(n).toBe(1);
    expect(
      (await ok<{ items: unknown[] }>(callAction(listNotifications, {}, owner))).items,
    ).toHaveLength(1);
  });
});

describe('dispatch', () => {
  it('sends due deliveries through the senders and records the provider id', async () => {
    const sent = fakeSenders();
    const actor = await makeActor([]);
    await send(actor.contactId!);
    expect(await dispatchDue()).toMatchObject({ sent: 1 });
    expect(sent.email).toHaveLength(1);
    expect(sent.email[0]!.subject).toBe('Hello');
    expect(await deliveries()).toMatchObject([{ status: 'sent', providerId: 'e1', attempts: 1 }]);
  });

  it('retries failures after 1m, 5m, 30m, 2h, then gives up', async () => {
    fakeSenders({ email: { status: 'failed', error: 'boom' } });
    const actor = await makeActor([]);
    await send(actor.contactId!);
    let now = new Date();
    for (const wait of [60_000, 300_000, 1_800_000, 7_200_000]) {
      expect(await dispatchDue({ now })).toMatchObject({ retrying: 1 });
      const [d] = await deliveries();
      expect(d!.status).toBe('pending');
      expect(d!.nextAttemptAt.getTime() - now.getTime()).toBe(wait);
      now = d!.nextAttemptAt;
    }
    expect(await dispatchDue({ now })).toMatchObject({ failed: 1 });
    expect(await deliveries()).toMatchObject([
      { status: 'failed', attempts: 5, lastError: 'boom' },
    ]);
  });

  it('re-checks SMS consent at send time and skips blocked sends', async () => {
    const sent = fakeSenders();
    const actor = await makeActor([]);
    await getDb()
      .update(contacts)
      .set({ phone: '+18165550101' })
      .where(eq(contacts.id, actor.contactId!));
    await ok(callAction(setSmsConsent, { consent: true }, actor));
    await send(actor.contactId!, { channels: ['sms'] });
    await ok(callAction(setSmsConsent, { consent: false }, actor));
    await dispatchDue({ now: new Date(Date.now() + 86_400_000) });
    expect(sent.sms).toHaveLength(0);
    expect(await deliveries()).toMatchObject([{ channel: 'sms', status: 'skipped' }]);
    // A blocked result from the test-recipient guard is a skip, not a retry.
    fakeSenders({ email: { status: 'blocked', reason: 'Not a test recipient' } });
    await send(actor.contactId!, { dedupeKey: 'again', channels: ['email'] });
    await dispatchDue();
    expect((await deliveries()).find((d) => d.channel === 'email')).toMatchObject({
      status: 'skipped',
    });
  });
});

describe('quiet hours and the test-recipient guard', () => {
  it('moves night-time sends to 8am in the app time zone', () => {
    const night = new Date('2026-01-15T05:00:00Z'); // 23:00 the day before in Chicago
    expect(nextAllowedTime(night).toISOString()).toBe('2026-01-15T14:00:00.000Z');
    const noon = new Date('2026-01-15T18:00:00Z');
    expect(nextAllowedTime(noon)).toEqual(noon);
  });

  it('allows only TEST_RECIPIENTS_* outside production', () => {
    const was = { ...process.env };
    process.env.APP_ENV = 'test';
    process.env.TEST_RECIPIENTS_EMAIL = 'me@example.com';
    process.env.TEST_RECIPIENTS_SMS = '+18165550100';
    expect(isRecipientAllowed('email', 'ME+seed3@example.com')).toBe(true);
    expect(isRecipientAllowed('email', 'real@person.com')).toBe(false);
    expect(isRecipientAllowed('sms', '+18165550199')).toBe(false);
    expect(isRecipientAllowed('sms', '+18165550100')).toBe(true);
    process.env.APP_ENV = 'production';
    expect(isRecipientAllowed('email', 'real@person.com')).toBe(true);
    process.env = was;
  });
});

describe('error alerts', () => {
  it('a new bug notifies everyone with errors.manage, once', async () => {
    const owner = await makeActor(['owner']);
    await makeActor(['staff']);
    await reportError(new Error('Alert me'), { source: 'job' });
    await reportError(new Error('Alert me'), { source: 'job' });
    const rows = await getDb()
      .select()
      .from(notifications)
      .where(eq(notifications.type, 'staff.newError'));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.contactId).toBe(owner.contactId);
  });
});

describe('notification actions', () => {
  it('inbox: list, count, open, mark read, dismiss', async () => {
    const actor = await makeActor([]);
    await send(actor.contactId!, { dedupeKey: '1' });
    await send(actor.contactId!, { dedupeKey: '2' });
    expect(await ok(callAction(unreadCount, {}, actor))).toEqual({ unread: 2, attention: 0 });
    const list = await ok<{ items: { id: string }[] }>(callAction(listNotifications, {}, actor));
    const opened = await ok<{ url: string }>(
      callAction(openNotification, { id: list.items[0]!.id }, actor),
    );
    expect(opened.url).toBe('/account');
    expect((await ok<{ unread: number }>(callAction(unreadCount, {}, actor))).unread).toBe(1);
    expect(await ok(callAction(markRead, {}, actor))).toEqual({ updated: 1 });
    expect(await ok(callAction(dismissNotifications, {}, actor))).toEqual({ dismissed: 2 });
    expect(
      (await ok<{ items: unknown[] }>(callAction(listNotifications, {}, actor))).items,
    ).toHaveLength(0);
    // Somebody else's notification is not yours to open.
    const other = await makeActor([]);
    expect(await callAction(openNotification, { id: list.items[0]!.id }, other)).toMatchObject({
      ok: false,
      error: { code: 'not_found' },
    });
  });

  it('preferences show what each person can change; required email stays on', async () => {
    const owner = await makeActor(['owner']);
    const prefs = await ok<{ types: { key: string; audience: string }[]; smsConsentText: string }>(
      callAction(getPreferences, {}, owner),
    );
    expect(prefs.types.map((t) => t.key)).toEqual(
      expect.arrayContaining(['account.message', 'staff.newError']),
    );
    const customer = await makeActor([]);
    const mine = await ok<{ types: { key: string }[] }>(callAction(getPreferences, {}, customer));
    expect(mine.types.map((t) => t.key)).toEqual(['account.message']);
    expect(
      await callAction(
        setPreference,
        { type: 'staff.newError', channel: 'email', enabled: false },
        customer,
      ),
    ).toMatchObject({ ok: false, error: { code: 'not_found' } });
  });

  it('consent: staff can record it for someone else; customers cannot; a phone is needed', async () => {
    const customer = await makeActor([]);
    const manager = await makeActor(['manager']);
    expect(
      await callAction(
        setSmsConsent,
        { contactId: customer.contactId!, consent: true, phone: '8165550123' },
        await makeActor([]),
      ),
    ).toMatchObject({ ok: false, error: { code: 'forbidden' } });
    expect(await callAction(setSmsConsent, { consent: true }, customer)).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
    const res = await ok<{ phone: string }>(
      callAction(
        setSmsConsent,
        { contactId: customer.contactId!, consent: true, phone: '8165550123' },
        manager,
      ),
    );
    expect(res.phone).toBe('+18165550123');
    const [c] = await getDb().select().from(contacts).where(eq(contacts.id, customer.contactId!));
    expect(c!.smsConsentSource).toBe('staff');
  });

  it('sendTest queues the channels the person gets; unsubscribe works from a signed link', async () => {
    const actor = await makeActor([]);
    expect(await ok<{ channels: string[] }>(callAction(sendTest, {}, actor))).toEqual({
      channels: ['inbox', 'email'],
    });
    expect(
      await ok<{ label: string }>(
        callAction(
          unsubscribe,
          { token: signUnsubscribe(actor.contactId!, 'account.message') },
          guestActor(),
        ),
      ),
    ).toEqual({ label: 'Updates and reminders' });
    expect(await callAction(unsubscribe, { token: 'garbage' }, guestActor())).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
    await send(actor.contactId!, { dedupeKey: 'after' });
    expect((await deliveries()).filter((d) => d.status === 'pending')).toHaveLength(1); // just the test email from before
  });

  it('delivery log lists and filters; retry only for failed or skipped', async () => {
    fakeSenders({ email: { status: 'failed', error: 'nope' } });
    const owner = await makeActor(['owner']);
    const actor = await makeActor([]);
    await send(actor.contactId!);
    let now = new Date();
    for (let i = 0; i < 5; i++) {
      await dispatchDue({ now });
      now = new Date(now.getTime() + 3 * 3_600_000);
    }
    const list = await ok<{ id: string; status: string }[]>(
      callAction(listDeliveries, { status: 'failed', contactId: actor.contactId! }, owner),
    );
    expect(list).toHaveLength(1);
    expect(await ok(callAction(retryDelivery, { id: list[0]!.id }, owner))).toMatchObject({
      status: 'pending',
    });
    expect(await callAction(retryDelivery, { id: list[0]!.id }, owner)).toMatchObject({
      ok: false,
      error: { code: 'conflict' },
    });
    const manager = await makeActor(['manager']); // manager has notifications.manage
    expect(await ok<unknown[]>(callAction(listDeliveries, {}, manager))).toHaveLength(1);
    expect(await callAction(listDeliveries, {}, actor)).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
  });

  it('a STOP reply suppresses the number and withdraws consent (system only)', async () => {
    const actor = await makeActor([]);
    await getDb()
      .update(contacts)
      .set({ phone: '+18165550101' })
      .where(eq(contacts.id, actor.contactId!));
    await ok(callAction(setSmsConsent, { consent: true }, actor));
    const { systemActor } = await import('../src/access');
    await ok(
      callAction(
        recordSuppression,
        { channel: 'sms', address: '+18165550101', reason: 'stop' },
        systemActor(),
      ),
    );
    const [c] = await getDb().select().from(contacts).where(eq(contacts.id, actor.contactId!));
    expect(c!.smsConsentAt).toBeNull();
    expect(
      await getDb()
        .select()
        .from(messageSuppressions)
        .where(and(eq(messageSuppressions.channel, 'sms'))),
    ).toHaveLength(1);
    expect(
      await callAction(recordSuppression, { channel: 'sms', address: '+1', reason: 'stop' }, actor),
    ).toMatchObject({ ok: false, error: { code: 'forbidden' } });
  });
});
