import { createHmac } from 'node:crypto';

import {
  contacts,
  eq,
  getDb,
  messageSuppressions,
  notificationDeliveries,
  notifications,
} from '@app/db';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { systemActor } from '../src/access';
import { callAction } from '../src/actions';
import { quoWebhook, resendWebhook, smsKeyword } from '../src/actions/webhooks';
import { verifyQuo, verifySvix } from '../src/webhooks/verify';
import { assertLocalDatabase, ifEventsEnabled, makeActor, resetDatabase } from './setup';

beforeAll(assertLocalDatabase);
beforeEach(resetDatabase);

const sys = () => systemActor('system');
const run = async <T>(p: Promise<{ ok: boolean }>) => {
  const r = (await p) as { ok: boolean; data?: T; error?: unknown };
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.data as T;
};
// Event assertions run only when the events module is on (docs/architecture.md → Modules).

// ---------------------------------------------------------------- signatures

describe('Svix signature (Resend)', () => {
  const key = Buffer.from('super-secret-signing-key-0123456789');
  const secret = `whsec_${key.toString('base64')}`;
  const now = new Date('2026-11-09T12:00:00Z');
  const ts = String(Math.floor(now.getTime() / 1000));
  const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 're_1' } });
  const sign = (id: string, t: string, b: string) =>
    createHmac('sha256', key).update(`${id}.${t}.${b}`).digest('base64');
  const headers = (over: Record<string, string> = {}) => {
    const h: Record<string, string> = {
      'svix-id': 'msg_1',
      'svix-timestamp': ts,
      'svix-signature': `v1,${sign('msg_1', ts, body)}`,
      ...over,
    };
    return { get: (n: string) => h[n] ?? null };
  };

  it('accepts a correct signature, including one of several during a secret rotation', () => {
    expect(verifySvix({ secret, headers: headers(), body, now })).toEqual({ ok: true });
    const rotating = headers({ 'svix-signature': `v1,AAAA v1,${sign('msg_1', ts, body)}` });
    expect(verifySvix({ secret, headers: rotating, body, now })).toEqual({ ok: true });
  });

  it('refuses a tampered body, a wrong secret, missing headers and non-v1 signatures', () => {
    expect(verifySvix({ secret, headers: headers(), body: body + ' ', now }).ok).toBe(false);
    expect(
      verifySvix({
        secret: 'whsec_' + Buffer.from('other').toString('base64'),
        headers: headers(),
        body,
        now,
      }).ok,
    ).toBe(false);
    expect(verifySvix({ secret, headers: { get: () => null }, body, now })).toMatchObject({
      ok: false,
    });
    expect(
      verifySvix({
        secret,
        headers: headers({ 'svix-signature': `v2,${sign('msg_1', ts, body)}` }),
        body,
        now,
      }).ok,
    ).toBe(false);
  });

  it('refuses replays: a timestamp too old or too far in the future', () => {
    const old = String(Math.floor(now.getTime() / 1000) - 600);
    const stale = headers({
      'svix-timestamp': old,
      'svix-signature': `v1,${sign('msg_1', old, body)}`,
    });
    expect(verifySvix({ secret, headers: stale, body, now })).toMatchObject({
      ok: false,
      reason: expect.stringContaining('replay'),
    });
    const future = String(Math.floor(now.getTime() / 1000) + 600);
    expect(
      verifySvix({
        secret,
        headers: headers({
          'svix-timestamp': future,
          'svix-signature': `v1,${sign('msg_1', future, body)}`,
        }),
        body,
        now,
      }).ok,
    ).toBe(false);
    expect(
      verifySvix({ secret, headers: headers({ 'svix-timestamp': 'soon' }), body, now }).ok,
    ).toBe(false);
  });
});

describe('Quo signature', () => {
  const key = Buffer.from('quo-signing-key-material');
  const secret = key.toString('base64');
  const now = new Date('2026-11-09T12:00:00Z');
  const body = JSON.stringify({ type: 'message.received' });
  const header = (t: number, b = body) =>
    `hmac;1;${t};${createHmac('sha256', key).update(`${t}.${b}`).digest('base64')}`;
  const h = (values: Record<string, string>) => ({ get: (n: string) => values[n] ?? null });

  it('accepts the openphone-signature HMAC (timestamp in milliseconds or seconds)', () => {
    expect(
      verifyQuo({
        secret,
        headers: h({ 'openphone-signature': header(now.getTime()) }),
        body,
        now,
      }),
    ).toEqual({ ok: true });
    const seconds = Math.floor(now.getTime() / 1000);
    expect(
      verifyQuo({ secret, headers: h({ 'openphone-signature': header(seconds) }), body, now }),
    ).toEqual({ ok: true });
  });

  it('refuses a bad digest, a tampered body, an old timestamp and a malformed header', () => {
    const good = header(now.getTime());
    expect(
      verifyQuo({ secret, headers: h({ 'openphone-signature': good }), body: body + 'x', now }).ok,
    ).toBe(false);
    expect(
      verifyQuo({
        secret,
        headers: h({ 'openphone-signature': good.slice(0, -4) + 'AAAA' }),
        body,
        now,
      }).ok,
    ).toBe(false);
    expect(
      verifyQuo({
        secret,
        headers: h({ 'openphone-signature': header(now.getTime() - 3_600_000) }),
        body,
        now,
      }),
    ).toMatchObject({
      ok: false,
      reason: expect.stringContaining('replay'),
    });
    expect(
      verifyQuo({ secret, headers: h({ 'openphone-signature': 'nonsense' }), body, now }).ok,
    ).toBe(false);
  });

  it('falls back to the shared secret header when there is no signature', () => {
    expect(verifyQuo({ secret, headers: h({ 'x-webhook-secret': secret }), body, now })).toEqual({
      ok: true,
    });
    expect(verifyQuo({ secret, headers: h({ 'x-webhook-secret': 'wrong' }), body, now }).ok).toBe(
      false,
    );
    expect(verifyQuo({ secret, headers: h({}), body, now }).ok).toBe(false);
  });
});

// ---------------------------------------------------------------- Resend handler

async function sentEmail(providerId = 're_1', address = 'pat@example.com') {
  const [c] = await getDb()
    .insert(contacts)
    .values({ displayName: 'Pat', email: address, source: 'seed' })
    .returning();
  const [n] = await getDb()
    .insert(notifications)
    .values({
      contactId: c!.id,
      type: 'account.message',
      content: { title: 't', body: 'b', emailSubject: 's', sms: 's' },
    })
    .returning();
  const [d] = await getDb()
    .insert(notificationDeliveries)
    .values({ notificationId: n!.id, channel: 'email', status: 'sent', to: address, providerId })
    .returning();
  return { contact: c!, delivery: d! };
}
const delivery = async (id: string) =>
  (
    await getDb().select().from(notificationDeliveries).where(eq(notificationDeliveries.id, id))
  )[0]!;

describe('webhooks.resendEvent', () => {
  const evt = (type: string, data: Record<string, unknown>, eventId = 'msg_1') => ({
    eventId,
    type,
    data,
  });

  it('delivered: marks the delivery delivered', async () => {
    const { delivery: d } = await sentEmail();
    const r = await run<{ handled: boolean }>(
      callAction(
        resendWebhook,
        evt('email.delivered', { email_id: 're_1', to: ['pat@example.com'] }),
        sys(),
      ),
    );
    expect(r.handled).toBe(true);
    expect(await delivery(d.id)).toMatchObject({ status: 'delivered' });
  });

  it('a permanent bounce fails the delivery, suppresses the address and emits email.bounced once', async () => {
    const { delivery: d, contact } = await sentEmail();
    const payload = evt('email.bounced', {
      email_id: 're_1',
      to: ['Pat@Example.com'],
      bounce: { type: 'Permanent', message: 'No such mailbox' },
    });
    await run(callAction(resendWebhook, payload, sys()));
    await run(callAction(resendWebhook, payload, sys())); // the provider retried: harmless
    expect(await delivery(d.id)).toMatchObject({
      status: 'failed',
      lastError: expect.stringContaining('No such mailbox'),
    });
    expect(await getDb().select().from(messageSuppressions)).toMatchObject([
      { channel: 'email', address: 'pat@example.com', reason: 'bounce' },
    ]);
    await ifEventsEnabled('email.bounced', (emitted) => {
      expect(emitted).toHaveLength(1);
      expect(emitted[0]!.data).toMatchObject({
        kind: 'bounce',
        permanent: true,
        contactId: contact.id,
        email: 'pat@example.com',
      });
    });
  });

  it('a temporary bounce does not suppress the address', async () => {
    await sentEmail();
    await run(
      callAction(
        resendWebhook,
        evt('email.bounced', {
          email_id: 're_1',
          to: ['pat@example.com'],
          bounce: { type: 'Transient' },
        }),
        sys(),
      ),
    );
    expect(await getDb().select().from(messageSuppressions)).toHaveLength(0);
    await ifEventsEnabled('email.bounced', (e) =>
      expect(e[0]!.data).toMatchObject({ permanent: false }),
    );
  });

  it('a spam complaint suppresses the address', async () => {
    await sentEmail();
    await run(
      callAction(
        resendWebhook,
        evt('email.complained', { email_id: 're_1', to: ['pat@example.com'] }),
        sys(),
      ),
    );
    expect(await getDb().select().from(messageSuppressions)).toMatchObject([
      { reason: 'complaint' },
    ]);
    await ifEventsEnabled('email.bounced', (e) =>
      expect(e[0]!.data).toMatchObject({ kind: 'complaint' }),
    );
  });

  it('ignores types it does not know and refuses everyone but the system', async () => {
    expect(
      await run(callAction(resendWebhook, evt('email.opened', { email_id: 'x' }), sys())),
    ).toMatchObject({ handled: false });
    const manager = await makeActor(['owner']);
    expect(await callAction(resendWebhook, evt('email.delivered', {}), manager)).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
  });
});

// ---------------------------------------------------------------- Quo handler

describe('smsKeyword', () => {
  it('recognises exact opt-out / opt-in words only', () => {
    for (const w of ['STOP', ' stop. ', 'Stop All', 'UNSUBSCRIBE', 'cancel', 'End', 'QUIT'])
      expect(smsKeyword(w)).toBe('stop');
    for (const w of ['START', 'unstop']) expect(smsKeyword(w)).toBe('start');
    for (const w of ['please stop', 'stop texting me', 'yes', 'hello', ''])
      expect(smsKeyword(w)).toBeNull();
  });
});

describe('webhooks.quoEvent', () => {
  const inbound = (text: string, id = 'AC1', from = '+18165550100') => ({
    eventId: `evt-${id}`,
    type: 'message.received',
    data: { object: { id, from, to: ['+18165550199'], text, direction: 'incoming' } },
  });
  const consenting = async () => {
    const [c] = await getDb()
      .insert(contacts)
      .values({
        displayName: 'Pat',
        phone: '+18165550100',
        smsConsentAt: new Date(),
        smsConsentSource: 'account',
        smsConsentText: 'ok',
        source: 'seed',
      })
      .returning();
    return c!;
  };
  const fresh = async (id: string) =>
    (await getDb().select().from(contacts).where(eq(contacts.id, id)))[0]!;

  it('stores an inbound text as an sms.received event, once per message id', async () => {
    const c = await consenting();
    await run(callAction(quoWebhook, inbound('Can I move to Friday?'), sys()));
    await run(callAction(quoWebhook, inbound('Can I move to Friday?'), sys()));
    await ifEventsEnabled('sms.received', (rows) => {
      expect(rows).toHaveLength(1);
      expect(rows[0]!.data).toMatchObject({
        from: '+18165550100',
        to: '+18165550199',
        text: 'Can I move to Friday?',
        keyword: null,
        contactId: c.id,
      });
    });
    expect((await fresh(c.id)).smsConsentAt).not.toBeNull();
  });

  it('STOP clears consent and suppresses the number; START restores both', async () => {
    const c = await consenting();
    await run(callAction(quoWebhook, inbound('STOP', 'AC2'), sys()));
    expect(await fresh(c.id)).toMatchObject({ smsConsentAt: null, smsConsentSource: null });
    expect(await getDb().select().from(messageSuppressions)).toMatchObject([
      { channel: 'sms', address: '+18165550100', reason: 'stop' },
    ]);
    await ifEventsEnabled('sms.received', (e) =>
      expect(e[0]!.data).toMatchObject({ keyword: 'stop' }),
    );

    await run(callAction(quoWebhook, inbound('start', 'AC3'), sys()));
    expect(await fresh(c.id)).toMatchObject({ smsConsentSource: 'sms-reply' });
    expect((await fresh(c.id)).smsConsentAt).not.toBeNull();
    expect(await getDb().select().from(messageSuppressions)).toHaveLength(0);
  });

  it('a number nobody has still gets its text recorded (no contact)', async () => {
    await run(callAction(quoWebhook, inbound('hello', 'AC4', '+18165550777'), sys()));
    await ifEventsEnabled('sms.received', (e) =>
      expect(e[0]!.data).toMatchObject({ contactId: null }),
    );
  });

  it('delivery reports update the delivery; outbound messages are ignored', async () => {
    const { delivery: d } = await sentEmail('msg_sms_1', 'x@example.com');
    await getDb()
      .update(notificationDeliveries)
      .set({ channel: 'sms', to: '+18165550100' })
      .where(eq(notificationDeliveries.id, d.id));
    await run(
      callAction(
        quoWebhook,
        {
          eventId: 'e9',
          type: 'message.delivered',
          data: { object: { id: 'msg_sms_1', status: 'delivered' } },
        },
        sys(),
      ),
    );
    expect(await delivery(d.id)).toMatchObject({ status: 'delivered' });
    const outbound = {
      eventId: 'e10',
      type: 'message.received',
      data: { object: { id: 'AC5', from: '+18165550199', direction: 'outgoing', text: 'hi' } },
    };
    expect(await run(callAction(quoWebhook, outbound, sys()))).toMatchObject({ handled: false });
    await ifEventsEnabled('sms.received', (e) => expect(e).toHaveLength(0));
  });

  it('is system only', async () => {
    const owner = await makeActor(['owner']);
    expect(await callAction(quoWebhook, inbound('STOP'), owner)).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
  });
});
