// rules-ok: no-db-in-web — route tests seed and inspect the local test database directly
import { contacts, getDb } from '@app/db';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { GET as listActions } from '@/app/api/v1/actions/route';
import { POST as runAction } from '@/app/api/v1/actions/[name]/route';
import { GET as openapi } from '@/app/api/v1/openapi.json/route';

import { assertLocalDatabase, bearer, json, makeKey, request, resetDatabase } from '../helpers';

beforeAll(assertLocalDatabase);
beforeEach(resetDatabase);

const call = (name: string, init: Parameters<typeof request>[1]) =>
  runAction(request(`/api/v1/actions/${name}`, { method: 'POST', ...init }), {
    params: Promise.resolve({ name }),
  });
const count = async () => (await getDb().select().from(contacts)).length;

describe('REST: authentication and permissions', () => {
  it('runs an action for a valid key and answers { ok: true, data }', async () => {
    const { key } = await makeKey(['manager']);
    const res = await call('contacts.create', {
      headers: bearer(key),
      body: { firstName: 'Ann', email: 'ann@example.com' },
    });
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({
      ok: true,
      data: { displayName: 'Ann', email: 'ann@example.com' },
    });
  });

  it('401 for a bad, malformed or revoked key — never a silent guest', async () => {
    for (const headers of [bearer('app_sk_doesnotexist'), bearer('nonsense')]) {
      const res = await call('contacts.list', { headers, body: {} });
      expect(res.status, JSON.stringify(headers)).toBe(401);
      expect((await json(res)).error.code).toBe('unauthenticated');
    }
  });

  it('403 when the key’s owner may not run the action; and a restricted key is narrowed', async () => {
    const { key: staff } = await makeKey(['staff']);
    const denied = await call('contacts.create', {
      headers: bearer(staff),
      body: { firstName: 'X' },
    });
    expect(denied.status).toBe(403);
    expect(await json(denied)).toMatchObject({ ok: false, error: { code: 'forbidden' } });
    const { key: narrow } = await makeKey(['owner'], ['users.read']);
    expect((await call('contacts.list', { headers: bearer(narrow), body: {} })).status).toBe(200);
    expect(
      (await call('contacts.create', { headers: bearer(narrow), body: { firstName: 'X' } })).status,
    ).toBe(403);
  });

  it('400 for invalid input (with the reason), 404 for an unknown action, 400 for a body that is not JSON', async () => {
    const { key } = await makeKey(['manager']);
    const bad = await call('contacts.create', {
      headers: bearer(key),
      body: { email: 'not-an-email' },
    });
    expect(bad.status).toBe(400);
    expect((await json(bad)).error).toMatchObject({
      code: 'invalid_input',
      message: expect.stringContaining('email'),
    });
    expect((await call('nope.nothing', { headers: bearer(key), body: {} })).status).toBe(404);
    const notJson = await call('contacts.list', {
      headers: { ...bearer(key), 'content-type': 'application/json' },
      raw: '{oops',
    });
    expect(notJson.status).toBe(400);
  });

  it('refuses cookie-less, key-less calls that are not same-origin JSON (cross-site form posts)', async () => {
    const res = await call('inquiries.create', {
      raw: 'name=x',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(res.status).toBe(403);
  });

  it('GET /api/v1/actions lists only what the key may run, with input schemas', async () => {
    const { key } = await makeKey(['staff']);
    const res = await listActions(request('/api/v1/actions', { headers: bearer(key) }));
    const body = await json<{ actions: { name: string; inputSchema: unknown }[] }>(res);
    const names = body.actions.map((a) => a.name);
    expect(names).toContain('contacts.list');
    expect(names).not.toContain('contacts.create');
    expect(names).not.toContain('webhooks.quoEvent'); // system-only
    expect(body.actions.every((a) => a.inputSchema)).toBe(true);
    expect(
      (await listActions(request('/api/v1/actions', { headers: bearer('app_sk_bad') }))).status,
    ).toBe(401);
  });
});

describe('REST: idempotency keys', () => {
  const body = { firstName: 'Ann', email: 'ann@example.com' };

  it('the same key replays the first result and changes nothing twice', async () => {
    const { key } = await makeKey(['manager']);
    const headers = { ...bearer(key), 'idempotency-key': 'order-7' };
    const first = await call('contacts.create', { headers, body });
    expect(first.status).toBe(200);
    expect(first.headers.get('Idempotent-Replayed')).toBeNull();
    const before = await count();
    const second = await call('contacts.create', { headers, body });
    expect(second.status).toBe(200);
    expect(second.headers.get('Idempotent-Replayed')).toBe('true');
    expect((await json(second)).data.id).toBe((await json(first)).data.id);
    expect(await count()).toBe(before);
  });

  it('the same key with different input is a conflict (409); without a key it is a normal duplicate', async () => {
    const { key } = await makeKey(['manager']);
    const headers = { ...bearer(key), 'idempotency-key': 'order-8' };
    await call('contacts.create', { headers, body });
    const different = await call('contacts.create', {
      headers,
      body: { firstName: 'Bo', email: 'bo@example.com' },
    });
    expect(different.status).toBe(409);
    const duplicate = await call('contacts.create', { headers: bearer(key), body });
    expect(duplicate.status).toBe(409);
    expect((await json(duplicate)).error.message).toContain('already belongs');
  });

  it('an invalid key is refused, and keys are per caller', async () => {
    const a = await makeKey(['manager']);
    const b = await makeKey(['manager']);
    const bad = await call('contacts.create', {
      headers: { ...bearer(a.key), 'idempotency-key': 'x'.repeat(300) },
      body,
    });
    expect(bad.status).toBe(400);
    await call('contacts.create', {
      headers: { ...bearer(a.key), 'idempotency-key': 'same' },
      body,
    });
    const other = await call('contacts.create', {
      headers: { ...bearer(b.key), 'idempotency-key': 'same' },
      body: { firstName: 'Bo', email: 'bo@example.com' },
    });
    expect(other.status).toBe(200);
    expect(other.headers.get('Idempotent-Replayed')).toBeNull();
  });
});

describe('REST: rate limiting', () => {
  const form = { name: 'Pat', email: 'pat@example.com', message: 'Hello, is anyone there?' };
  const post = () =>
    call('inquiries.create', {
      headers: {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'x-forwarded-for': '203.0.113.50',
      },
      body: form,
    });

  it('answers 429 with Retry-After once a visitor is over the limit', async () => {
    for (let i = 0; i < 5; i++) expect((await post()).status).toBe(200);
    const limited = await post();
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect((await json(limited)).error.code).toBe('rate_limited');
  });

  it('counts per IP: another visitor is not affected', async () => {
    for (let i = 0; i < 6; i++) await post();
    const other = await call('inquiries.create', {
      headers: {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'x-forwarded-for': '198.51.100.99',
      },
      body: form,
    });
    expect(other.status).toBe(200);
  });
});

describe('REST: openapi.json', () => {
  it('is a valid OpenAPI 3.1 document describing every action the key may run', async () => {
    const { key } = await makeKey(['owner']);
    const res = await openapi(request('/api/v1/openapi.json', { headers: bearer(key) }));
    expect(res.status).toBe(200);
    const doc = await json<{
      openapi: string;
      info: { title: string; version: string };
      paths: Record<
        string,
        {
          post: {
            operationId: string;
            requestBody: unknown;
            responses: Record<string, unknown>;
            parameters: { name: string }[];
          };
        }
      >;
      components: { schemas: Record<string, unknown>; securitySchemes: object };
    }>(res);
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toBeTruthy();
    const paths = Object.entries(doc.paths);
    expect(paths.length).toBeGreaterThan(40);
    const ids = new Set<string>();
    for (const [path, item] of paths) {
      expect(path).toMatch(/^\/api\/v1\/actions\/[A-Za-z]+\.[A-Za-z]+$/);
      const op = item.post;
      expect(op.operationId, path).toMatch(/^[A-Za-z]+_[A-Za-z]+$/);
      expect(ids.has(op.operationId), `duplicate ${op.operationId}`).toBe(false);
      ids.add(op.operationId);
      expect(op.responses['200']).toBeTruthy();
      expect(op.requestBody).toBeTruthy();
    }
    // Every $ref resolves to a component.
    const refs = [...JSON.stringify(doc).matchAll(/"\$ref":"#\/components\/schemas\/(\w+)"/g)].map(
      (m) => m[1]!,
    );
    expect(refs.length).toBeGreaterThan(0);
    for (const name of refs) expect(doc.components.schemas[name], name).toBeTruthy();
    // Changes accept Idempotency-Key; the new actions are there.
    expect(
      doc.paths['/api/v1/actions/contacts.create']!.post.parameters.map((p) => p.name),
    ).toContain('Idempotency-Key');
    for (const name of [
      'search.query',
      'contacts.import',
      'push.subscribe',
      'flags.set',
      'inquiries.list',
    ]) {
      expect(doc.paths[`/api/v1/actions/${name}`], name).toBeTruthy();
    }
  });

  it('shows a restricted caller fewer paths, and rejects a bad key', async () => {
    const { key } = await makeKey(['staff']);
    const small = await json<{ paths: object }>(
      await openapi(request('/api/v1/openapi.json', { headers: bearer(key) })),
    );
    const { key: owner } = await makeKey(['owner']);
    const big = await json<{ paths: object }>(
      await openapi(request('/api/v1/openapi.json', { headers: bearer(owner) })),
    );
    expect(Object.keys(small.paths).length).toBeLessThan(Object.keys(big.paths).length);
    expect(
      (await openapi(request('/api/v1/openapi.json', { headers: bearer('app_sk_bad') }))).status,
    ).toBe(401);
  });
});
