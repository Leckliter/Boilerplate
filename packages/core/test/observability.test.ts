import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  checkEmail,
  checkPush,
  checkSms,
  checkStorage,
  checkWebhooks,
  deepHealthChecks,
} from '../src/health-deep';
import { currentLogLevel, logger, setLogSinkForTests } from '../src/logger';
import { setStorageForTests, type Storage } from '../src/files/s3';
import { generateVAPIDKeys } from 'web-push';

const lines: { level: string; line: Record<string, unknown> }[] = [];
beforeEach(() => {
  lines.length = 0;
  setLogSinkForTests((level, text) => lines.push({ level, line: JSON.parse(text) }));
});
afterEach(() => {
  setLogSinkForTests(null);
  setStorageForTests(undefined);
  delete process.env.LOG_LEVEL;
});

describe('logger', () => {
  it('writes one JSON line per call with time, level, message and the request id', () => {
    const log = logger({ source: 'webhook.resend', requestId: 'req-1' });
    log.info('received', { type: 'email.bounced' });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.line).toMatchObject({
      level: 'info',
      message: 'received',
      requestId: 'req-1',
      source: 'webhook.resend',
      type: 'email.bounced',
    });
    expect(typeof lines[0]!.line.time).toBe('string');
  });

  it('makes up a request id when none is given and child loggers add fields', () => {
    const log = logger();
    expect(log.requestId).toMatch(/^[0-9a-f-]{36}$/);
    log.child({ eventId: 'e1' }).warn('slow', { ms: 900 });
    expect(lines[0]).toMatchObject({
      level: 'warn',
      line: { eventId: 'e1', ms: 900, requestId: log.requestId },
    });
  });

  it('redacts secrets, including nested ones, and serialises errors', () => {
    const log = logger({ requestId: 'r' });
    log.error('failed', {
      authorization: 'Bearer abc',
      body: { password: 'hunter2', keep: 'ok' },
      err: new Error('boom'),
    });
    const { line } = lines[0]!;
    expect(line.authorization).toBe('[redacted]');
    expect(line.body).toEqual({ password: '[redacted]', keep: 'ok' });
    expect(line.err).toMatchObject({ name: 'Error', message: 'boom' });
    expect(JSON.stringify(line)).not.toContain('hunter2');
  });

  it('honours LOG_LEVEL', () => {
    process.env.LOG_LEVEL = 'warn';
    const log = logger();
    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');
    expect(lines.map((l) => l.level)).toEqual(['warn', 'error']);
    process.env.LOG_LEVEL = 'silent';
    log.error('quiet');
    expect(lines).toHaveLength(2);
    expect(currentLogLevel({ LOG_LEVEL: 'nonsense' })).toBe('info');
    expect(currentLogLevel({})).toBe('info');
    expect(currentLogLevel({ LOG_LEVEL: 'DEBUG' })).toBe('debug');
  });

  it('never throws on a circular field', () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(() => logger({ requestId: 'r' }).info('loop', { loop })).not.toThrow();
    expect(lines).toHaveLength(1);
  });
});

describe('deep health checks', () => {
  const response = (status: number, body: object = {}) =>
    new Response(JSON.stringify(body), { status });

  it('report "not configured" as fine when nothing is set up', async () => {
    const checks = await deepHealthChecks({}, vi.fn() as never);
    expect(Object.keys(checks)).toEqual([
      'deep/storage',
      'deep/email',
      'deep/sms',
      'deep/push',
      'deep/webhooks',
    ]);
    expect(Object.values(checks).every((c) => c.ok)).toBe(true);
  });

  it('email: asks Resend read-only (never POSTs /emails) and tells good keys from bad ones', async () => {
    const env = { RESEND_API_KEY: 're_x', EMAIL_FROM: 'a@b.c' };
    const fetchFn = vi.fn(async () => response(200));
    expect(await checkEmail(env, fetchFn as never)).toMatchObject({ ok: true });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/domains');
    expect(init.method).toBeUndefined();
    expect(
      await checkEmail(env, (async () => response(401, { name: 'restricted_api_key' })) as never),
    ).toMatchObject({ ok: true });
    expect(
      await checkEmail(env, (async () => response(401, { name: 'invalid_api_key' })) as never),
    ).toMatchObject({ ok: false, detail: expect.stringContaining('401') });
    expect(
      await checkEmail(env, (async () => {
        throw new Error('ENOTFOUND');
      }) as never),
    ).toMatchObject({ ok: false, detail: expect.stringContaining('ENOTFOUND') });
  });

  it('sms: lists numbers with the key', async () => {
    const env = { QUO_API_KEY: 'k', QUO_FROM_NUMBER: '+18165550199' };
    const fetchFn = vi.fn(async () => response(200));
    expect(await checkSms(env, fetchFn as never)).toMatchObject({ ok: true });
    expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toContain('/phone-numbers');
    expect(await checkSms(env, (async () => response(403)) as never)).toMatchObject({ ok: false });
  });

  it('storage: asks for a file that is not there; an error from the endpoint fails the check', async () => {
    const storage = { stat: vi.fn(async () => null) } as unknown as Storage;
    setStorageForTests(storage);
    expect(await checkStorage()).toMatchObject({
      ok: true,
      detail: expect.stringContaining('reachable'),
    });
    setStorageForTests({
      stat: async () => {
        throw new Error('AccessDenied');
      },
    } as unknown as Storage);
    expect(await checkStorage()).toMatchObject({
      ok: false,
      detail: expect.stringContaining('AccessDenied'),
    });
  });

  it('push: validates the VAPID keys without contacting anyone', () => {
    const keys = generateVAPIDKeys();
    const good = {
      VAPID_PUBLIC_KEY: keys.publicKey,
      VAPID_PRIVATE_KEY: keys.privateKey,
      VAPID_SUBJECT: 'mailto:ops@example.com',
    };
    expect(checkPush(good)).toMatchObject({ ok: true });
    expect(checkPush({ ...good, VAPID_SUBJECT: 'ops@example.com' })).toMatchObject({ ok: false });
    expect(checkPush({ ...good, VAPID_PUBLIC_KEY: 'short' })).toMatchObject({ ok: false });
    expect(checkPush({ VAPID_PUBLIC_KEY: keys.publicKey })).toMatchObject({
      ok: false,
      detail: expect.stringContaining('must all be set'),
    });
    expect(checkPush({})).toMatchObject({ ok: true, detail: 'not configured' });
  });

  it('webhooks: says which secrets are set (never their values)', () => {
    const r = checkWebhooks({ RESEND_WEBHOOK_SECRET: 'whsec_x' });
    expect(r.detail).toBe('Resend webhook secret set, Quo webhook secret not set');
    expect(JSON.stringify(r)).not.toContain('whsec_x');
  });
});
