import { getDb, notificationDeliveries, pushSubscriptions } from '@app/db';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { guestActor } from '../src/access';
import { callAction } from '../src/actions';
import { pushStatus, subscribePush, unsubscribePush } from '../src/actions/push';
import { dispatchDue, notify, setSendersForTests, type Senders } from '../src/notifications';
import { createWebPushSender, pushPublicKey, vapidFromEnv } from '../src/notifications/push-sender';
import { assertLocalDatabase, makeActor, resetDatabase } from './setup';

beforeAll(assertLocalDatabase);
beforeEach(resetDatabase);
afterEach(() => setSendersForTests(null));

const sub = (n = 1, over: object = {}) => ({
  endpoint: `https://push.example.test/send/device-${n}`,
  keys: {
    p256dh:
      'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
    auth: 'tBHItJI5svbpez7KI4CCXg',
  },
  label: 'Chrome on Android',
  ...over,
});

describe('push subscriptions', () => {
  it('subscribe stores a device; again with the same endpoint refreshes it; status lists it', async () => {
    const me = await makeActor([]);
    const first = await callAction(subscribePush, sub(1), me);
    expect(first).toMatchObject({ ok: true, data: { label: 'Chrome on Android' } });
    await callAction(subscribePush, sub(1, { label: 'Pixel' }), me);
    expect(await getDb().select().from(pushSubscriptions)).toHaveLength(1);
    const status = await callAction(pushStatus, {}, me);
    if (!status.ok) throw new Error(status.error.message);
    expect(status.data.subscriptions).toMatchObject([
      { label: 'Pixel', endpointHost: 'push.example.test' },
    ]);
    expect(JSON.stringify(status.data)).not.toContain('p256dh');
  });

  it('refuses non-https endpoints and signed-out visitors', async () => {
    const me = await makeActor([]);
    expect(
      await callAction(subscribePush, sub(1, { endpoint: 'http://push.example.test/x' }), me),
    ).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
    for (const result of [
      await callAction(subscribePush, sub(1), guestActor()),
      await callAction(unsubscribePush, { endpoint: sub(1).endpoint }, guestActor()),
      await callAction(pushStatus, {}, guestActor()),
    ]) {
      expect(result).toMatchObject({ ok: false, error: { code: 'unauthenticated' } });
    }
  });

  it('a device that changes hands moves to the person signed in now; you can only remove your own', async () => {
    const a = await makeActor([]);
    const b = await makeActor([]);
    await callAction(subscribePush, sub(1), a);
    await callAction(subscribePush, sub(1), b);
    const [row] = await getDb().select().from(pushSubscriptions);
    expect(row!.contactId).toBe(b.contactId);
    // a cannot remove b's device
    expect(await callAction(unsubscribePush, { endpoint: sub(1).endpoint }, a)).toMatchObject({
      ok: true,
      data: { removed: 0 },
    });
    expect(await callAction(unsubscribePush, { endpoint: sub(1).endpoint }, b)).toMatchObject({
      ok: true,
      data: { removed: 1 },
    });
    expect(await getDb().select().from(pushSubscriptions)).toHaveLength(0);
  });
});

describe('web push sender', () => {
  const env = {
    VAPID_PUBLIC_KEY: 'pub',
    VAPID_PRIVATE_KEY: 'priv',
    VAPID_SUBJECT: 'mailto:ops@example.com',
  };
  const target = { endpoint: 'https://push.example.test/x', p256dh: 'p', auth: 'a' };

  it('reports not_configured without VAPID keys and never calls the push service', async () => {
    let called = false;
    const send = createWebPushSender(
      async () => void (called = true),
      () => ({}),
    );
    expect(await send(target, '{}')).toEqual({ status: 'not_configured' });
    expect(called).toBe(false);
    expect(vapidFromEnv({})).toBeNull();
    expect(pushPublicKey({})).toBeNull();
    expect(pushPublicKey(env)).toBe('pub');
  });

  it('maps the push service’s answers: sent, gone (404/410), failed (everything else)', async () => {
    const answer = (statusCode?: number) =>
      createWebPushSender(
        async () => {
          if (statusCode) throw Object.assign(new Error(`HTTP ${statusCode}`), { statusCode });
        },
        () => env,
      );
    expect(await answer()(target, '{}')).toMatchObject({ status: 'sent' });
    expect(await answer(410)(target, '{}')).toEqual({ status: 'gone' });
    expect(await answer(404)(target, '{}')).toEqual({ status: 'gone' });
    expect(await answer(500)(target, '{}')).toMatchObject({ status: 'failed' });
    expect(await answer(413)(target, '{}')).toMatchObject({ status: 'failed' });
  });
});

describe('push delivery through notify + dispatch (injected sender)', () => {
  function pushSenders(result: 'sent' | 'gone') {
    const pushed: { endpoint: string; payload: string }[] = [];
    const senders: Senders = {
      email: async () => ({ status: 'sent', providerId: 'e' }),
      sms: async () => ({ status: 'sent', providerId: 's' }),
      push: async (t, payload) => {
        pushed.push({ endpoint: t.endpoint, payload });
        return result === 'sent' ? { status: 'sent', providerId: '' } : { status: 'gone' };
      },
    };
    setSendersForTests(senders);
    return pushed;
  }
  const send = (to: string) =>
    getDb().transaction((tx) =>
      notify(tx, 'account.message', {
        to,
        data: { title: 'Hello', body: 'World' },
        channels: ['push'],
      }),
    );

  it('sends to every subscribed device and stamps lastSuccessAt', async () => {
    const me = await makeActor([]);
    await callAction(subscribePush, sub(1), me);
    await callAction(subscribePush, sub(2), me);
    const pushed = pushSenders('sent');
    await send(me.contactId!);
    // Customers' pushes wait for the morning outside quiet hours: make it due now.
    await getDb()
      .update(notificationDeliveries)
      .set({ nextAttemptAt: new Date(0) });
    expect(await dispatchDue()).toMatchObject({ sent: 2 });
    expect(pushed.map((p) => p.endpoint).sort()).toEqual([sub(1).endpoint, sub(2).endpoint]);
    expect(JSON.parse(pushed[0]!.payload)).toMatchObject({ title: 'Hello', body: 'World' });
    const rows = await getDb().select().from(pushSubscriptions);
    expect(rows.every((r) => r.lastSuccessAt)).toBe(true);
  });

  it('prunes a subscription the push service says is gone (404/410)', async () => {
    const me = await makeActor([]);
    await callAction(subscribePush, sub(1), me);
    pushSenders('gone');
    await send(me.contactId!);
    await getDb()
      .update(notificationDeliveries)
      .set({ nextAttemptAt: new Date(0) });
    expect(await dispatchDue()).toMatchObject({ skipped: 1 });
    expect(await getDb().select().from(pushSubscriptions)).toHaveLength(0);
    const [d] = await getDb().select().from(notificationDeliveries);
    expect(d!.lastError).toContain('removed');
  });
});
