import { createHmac } from 'node:crypto';

// rules-ok: no-db-in-web — route tests seed and inspect the local test database directly
import { contacts, events, getDb, messageSuppressions } from '@app/db';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { POST as quo } from '@/app/api/webhooks/quo/route';
import { POST as resend } from '@/app/api/webhooks/resend/route';

import { assertLocalDatabase, json, request, resetDatabase } from '../helpers';

beforeAll(assertLocalDatabase);
beforeEach(resetDatabase);

const svixKey = () =>
  Buffer.from(process.env.RESEND_WEBHOOK_SECRET!.replace('whsec_', ''), 'base64');
const quoKey = () => Buffer.from(process.env.QUO_WEBHOOK_SECRET!, 'base64');

function svixRequest(
  payload: object,
  over: { id?: string; ts?: number; sign?: boolean; body?: string } = {},
) {
  const body = over.body ?? JSON.stringify(payload);
  const id = over.id ?? 'msg_route_1';
  const ts = String(over.ts ?? Math.floor(Date.now() / 1000));
  const sig = createHmac('sha256', svixKey()).update(`${id}.${ts}.${body}`).digest('base64');
  return request('/api/webhooks/resend', {
    method: 'POST',
    raw: body,
    headers: {
      'svix-id': id,
      'svix-timestamp': ts,
      'svix-signature': over.sign === false ? 'v1,AAAA' : `v1,${sig}`,
    },
  });
}

function quoRequest(
  payload: object,
  over: { ts?: number; secretHeader?: string; signature?: string } = {},
) {
  const body = JSON.stringify(payload);
  const ts = over.ts ?? Date.now();
  const sig = createHmac('sha256', quoKey()).update(`${ts}.${body}`).digest('base64');
  const headers: Record<string, string> = over.secretHeader
    ? { 'x-webhook-secret': over.secretHeader }
    : { 'openphone-signature': over.signature ?? `hmac;1;${ts};${sig}` };
  return request('/api/webhooks/quo', { method: 'POST', raw: body, headers });
}

const bounce = {
  type: 'email.bounced',
  created_at: new Date().toISOString(),
  data: {
    email_id: 're_9',
    to: ['gone@example.com'],
    bounce: { type: 'Permanent', message: 'Mailbox does not exist' },
  },
};

describe('POST /api/webhooks/resend', () => {
  it('a signed bounce suppresses the address, emits email.bounced and answers 200', async () => {
    const res = await resend(svixRequest(bounce));
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({
      ok: true,
      result: { handled: true, type: 'email.bounced' },
    });
    expect(await getDb().select().from(messageSuppressions)).toMatchObject([
      { channel: 'email', address: 'gone@example.com', reason: 'bounce' },
    ]);
    expect(
      (await getDb().select().from(events)).filter((e) => e.type === 'email.bounced'),
    ).toHaveLength(1);
  });

  it('is idempotent: the provider redelivering the same event id changes nothing', async () => {
    await resend(svixRequest(bounce));
    const again = await resend(svixRequest(bounce));
    expect(again.status).toBe(200);
    expect(
      (await getDb().select().from(events)).filter((e) => e.type === 'email.bounced'),
    ).toHaveLength(1);
    expect(await getDb().select().from(messageSuppressions)).toHaveLength(1);
  });

  it('401 for a forged signature, a tampered body or a replayed old timestamp — and nothing is written', async () => {
    expect((await resend(svixRequest(bounce, { sign: false }))).status).toBe(401);
    const good = svixRequest(bounce);
    const tampered = new Request(good.url, {
      method: 'POST',
      headers: good.headers,
      body: JSON.stringify({ ...bounce, data: { ...bounce.data, to: ['victim@example.com'] } }),
    });
    expect((await resend(tampered)).status).toBe(401);
    expect(
      (await resend(svixRequest(bounce, { ts: Math.floor(Date.now() / 1000) - 3600 }))).status,
    ).toBe(401);
    expect(await getDb().select().from(messageSuppressions)).toHaveLength(0);
    expect(await getDb().select().from(events)).toHaveLength(0);
  });

  it('400 for a signed body that is not JSON or not an event; 413 for a huge body; 503 without a configured secret', async () => {
    expect((await resend(svixRequest({}, { body: 'not json' }))).status).toBe(400);
    expect((await resend(svixRequest({ hello: 'world' }))).status).toBe(400);
    const big = request('/api/webhooks/resend', {
      method: 'POST',
      raw: '{}',
      headers: { 'content-length': '5000000' },
    });
    expect((await resend(big)).status).toBe(413);
    const signed = svixRequest(bounce);
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    delete process.env.RESEND_WEBHOOK_SECRET;
    try {
      expect((await resend(signed)).status).toBe(503);
    } finally {
      process.env.RESEND_WEBHOOK_SECRET = secret;
    }
  });

  it('acknowledges event types it ignores with 200 (so the provider stops retrying)', async () => {
    const res = await resend(
      svixRequest({ type: 'email.opened', data: { email_id: 'x' } }, { id: 'msg_route_2' }),
    );
    expect(res.status).toBe(200);
    expect((await json(res)).result.handled).toBe(false);
  });
});

describe('POST /api/webhooks/quo', () => {
  const inbound = (text: string, id = 'AC100') => ({
    id: `EV-${id}`,
    object: 'event',
    type: 'message.received',
    data: {
      object: { id, from: '+18165550100', to: ['+18165550199'], text, direction: 'incoming' },
    },
  });

  it('a signed STOP clears consent and records the inbound text as an event', async () => {
    const [c] = await getDb()
      .insert(contacts)
      .values({
        displayName: 'Pat',
        phone: '+18165550100',
        smsConsentAt: new Date(),
        source: 'seed',
      })
      .returning();
    const res = await quo(quoRequest(inbound('STOP')));
    expect(res.status).toBe(200);
    expect((await getDb().select().from(contacts))[0]).toMatchObject({
      id: c!.id,
      smsConsentAt: null,
    });
    expect(await getDb().select().from(messageSuppressions)).toMatchObject([
      { channel: 'sms', reason: 'stop' },
    ]);
    expect(
      (await getDb().select().from(events)).find((e) => e.type === 'sms.received')!.data,
    ).toMatchObject({ keyword: 'stop', contactId: c!.id });
  });

  it('also accepts the shared-secret header; refuses a wrong one, a bad signature and an old timestamp', async () => {
    expect(
      (
        await quo(
          quoRequest(inbound('hello', 'AC101'), { secretHeader: process.env.QUO_WEBHOOK_SECRET }),
        )
      ).status,
    ).toBe(200);
    expect(
      (await quo(quoRequest(inbound('hello', 'AC102'), { secretHeader: 'wrong' }))).status,
    ).toBe(401);
    expect(
      (await quo(quoRequest(inbound('hello', 'AC103'), { signature: 'hmac;1;1;AAAA' }))).status,
    ).toBe(401);
    expect(
      (await quo(quoRequest(inbound('hello', 'AC104'), { ts: Date.now() - 3_600_000 }))).status,
    ).toBe(401);
    expect(
      (await getDb().select().from(events)).filter((e) => e.type === 'sms.received'),
    ).toHaveLength(1);
  });

  it('redelivery of the same message is recorded once; 503 without a configured secret', async () => {
    await quo(quoRequest(inbound('hi', 'AC105')));
    await quo(quoRequest(inbound('hi', 'AC105')));
    expect(
      (await getDb().select().from(events)).filter((e) => e.type === 'sms.received'),
    ).toHaveLength(1);
    const signed = quoRequest(inbound('hi', 'AC106'));
    const secret = process.env.QUO_WEBHOOK_SECRET;
    delete process.env.QUO_WEBHOOK_SECRET;
    try {
      expect((await quo(signed)).status).toBe(503);
    } finally {
      process.env.QUO_WEBHOOK_SECRET = secret;
    }
  });
});
