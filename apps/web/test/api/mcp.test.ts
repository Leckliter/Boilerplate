// rules-ok: no-db-in-web — route tests seed and inspect the local test database directly
import { contacts, getDb } from '@app/db';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { DELETE, GET, POST } from '@/app/api/mcp/route';

import { assertLocalDatabase, bearer, json, makeKey, request, resetDatabase } from '../helpers';

beforeAll(assertLocalDatabase);
beforeEach(resetDatabase);

type Rpc = { jsonrpc: '2.0'; id?: number; method: string; params?: unknown };
let nextId = 0;
const rpc = (method: string, params?: unknown): Rpc => ({
  jsonrpc: '2.0',
  id: ++nextId,
  method,
  params,
});

/** POST one JSON-RPC message (or a batch) to /api/mcp the way an MCP client does. */
const mcp = (key: string | null, body: unknown, headers: Record<string, string> = {}) =>
  POST(
    request('/api/mcp', {
      method: 'POST',
      headers: {
        accept: 'application/json, text/event-stream',
        ...(key && bearer(key)),
        ...headers,
      },
      body,
    }),
  );

const text = (res: { content: { text: string }[] }) =>
  JSON.parse(res.content[0]!.text) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('MCP (official SDK, Streamable HTTP, stateless)', () => {
  it('initialize: negotiates the protocol, names the server, advertises tools and instructions', async () => {
    const { key } = await makeKey(['manager']);
    const res = await mcp(
      key,
      rpc('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test', version: '1' },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('mcp-session-id')).toBeNull(); // stateless
    const body = await json(res);
    expect(body.result).toMatchObject({
      protocolVersion: '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: expect.stringContaining('app') },
      instructions: expect.stringContaining('system_whoami'),
    });
  });

  it('works without an explicit Accept header (curl) and answers an unknown protocol version with a supported one', async () => {
    const { key } = await makeKey(['manager']);
    const res = await POST(
      request('/api/mcp', {
        method: 'POST',
        headers: bearer(key),
        body: rpc('initialize', {
          protocolVersion: '1999-01-01',
          capabilities: {},
          clientInfo: { name: 't', version: '1' },
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect((await json(res)).result.protocolVersion).toMatch(/^20\d\d-\d\d-\d\d$/);
  });

  it('ping and notifications: pong, and a notification is acknowledged with 202 and no body', async () => {
    const { key } = await makeKey(['staff']);
    expect((await json(await mcp(key, rpc('ping')))).result).toEqual({});
    const note = await mcp(key, { jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(note.status).toBe(202);
    expect(await note.text()).toBe('');
  });

  it('tools/list: a tool per action the key may run (dots → underscores), schemas, annotations; never public/system actions', async () => {
    const { key } = await makeKey(['staff']);
    const body = await json(await mcp(key, rpc('tools/list')));
    const tools = body.result.tools as {
      name: string;
      description: string;
      inputSchema: { type: string; properties?: Record<string, unknown> };
      annotations: { readOnlyHint: boolean };
    }[];
    const names = tools.map((t) => t.name);
    expect(names).toContain('contacts_list');
    expect(names).toContain('search_query');
    expect(names).not.toContain('contacts_create'); // staff may not
    expect(names).not.toContain('inquiries_create'); // public: a website form, not an AI tool
    expect(names).not.toContain('webhooks_quoEvent'); // system only
    const list = tools.find((t) => t.name === 'contacts_list')!;
    expect(list.inputSchema.type).toBe('object');
    expect(list.annotations.readOnlyHint).toBe(true);
    expect(list.description).toContain('Requires: users.read');
    // A manager sees changes too, each with the optional idempotencyKey argument.
    const { key: mgr } = await makeKey(['manager']);
    const mine = (await json(await mcp(mgr, rpc('tools/list')))).result.tools as typeof tools;
    const create = mine.find((t) => t.name === 'contacts_create')!;
    expect(create.annotations.readOnlyHint).toBe(false);
    expect(create.inputSchema.properties).toHaveProperty('idempotencyKey');
  });

  it('tools/call: success runs the action as the key’s owner and returns its data as text', async () => {
    const { key } = await makeKey(['manager']);
    const res = await json(
      await mcp(
        key,
        rpc('tools/call', {
          name: 'contacts_create',
          arguments: { firstName: 'Ann', email: 'ann@example.com' },
        }),
      ),
    );
    expect(res.result.isError).toBe(false);
    expect(text(res.result)).toMatchObject({ displayName: 'Ann', email: 'ann@example.com' });
    expect(await getDb().select().from(contacts)).toHaveLength(2); // the key's owner + Ann
    const who = await json(
      await mcp(key, rpc('tools/call', { name: 'system_whoami', arguments: {} })),
    );
    expect(text(who.result)).toMatchObject({ kind: 'api_key' });
  });

  it('tools/call: invalid input is a tool error (isError) with the reason, not a transport error', async () => {
    const { key } = await makeKey(['manager']);
    const res = await json(
      await mcp(
        key,
        rpc('tools/call', { name: 'contacts_create', arguments: { email: 'not-an-email' } }),
      ),
    );
    expect(res.result.isError).toBe(true);
    expect(text(res.result)).toMatchObject({
      code: 'invalid_input',
      message: expect.stringContaining('email'),
    });
    expect(await getDb().select().from(contacts)).toHaveLength(1);
  });

  it('tools/call: a tool the key may not run is not there — JSON-RPC invalid params, nothing happens', async () => {
    const { key } = await makeKey(['staff']);
    const res = await json(
      await mcp(
        key,
        rpc('tools/call', { name: 'contacts_create', arguments: { firstName: 'Sneaky' } }),
      ),
    );
    expect(res.error).toMatchObject({
      code: -32602,
      message: expect.stringContaining('Unknown tool'),
    });
    expect(await getDb().select().from(contacts)).toHaveLength(1);
    const unknown = await json(
      await mcp(key, rpc('tools/call', { name: 'no_such_tool', arguments: {} })),
    );
    expect(unknown.error.code).toBe(-32602);
  });

  it('tools/call: a key narrowed to some permissions cannot use the rest', async () => {
    const { key } = await makeKey(['owner'], ['users.read']);
    const names = (
      (await json(await mcp(key, rpc('tools/list')))).result.tools as { name: string }[]
    ).map((t) => t.name);
    expect(names).toContain('contacts_list');
    expect(names).not.toContain('contacts_create');
    expect(names).not.toContain('settings_set');
  });

  it('tools/call: idempotencyKey makes a retried change harmless', async () => {
    const { key } = await makeKey(['manager']);
    const args = { firstName: 'Ann', email: 'ann@example.com', idempotencyKey: 'mcp-1' };
    const first = await json(
      await mcp(key, rpc('tools/call', { name: 'contacts_create', arguments: args })),
    );
    const again = await json(
      await mcp(key, rpc('tools/call', { name: 'contacts_create', arguments: args })),
    );
    expect(again.result.isError).toBe(false);
    expect(text(again.result).id).toBe(text(first.result).id);
    expect(await getDb().select().from(contacts)).toHaveLength(2);
  });

  it('a batch of messages gets a batch of answers', async () => {
    const { key } = await makeKey(['manager']);
    const res = await mcp(key, [rpc('ping'), rpc('tools/list')]);
    const body = (await res.json()) as { id: number; result: unknown }[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
  });

  it('401 without a key or with a bad key (also for a signed-out cookie visitor); GET and DELETE are 405', async () => {
    for (const key of [null, 'app_sk_nope']) {
      const res = await mcp(key, rpc('tools/list'));
      expect(res.status).toBe(401);
      expect(res.headers.get('www-authenticate')).toBe('Bearer');
      expect((await json(res)).error.code).toBe(-32001);
    }
    expect((await GET()).status).toBe(405);
    expect((await DELETE()).status).toBe(405);
  });

  it('malformed requests: not JSON → parse error; unknown method → method not found; wrong content type → 415', async () => {
    const { key } = await makeKey(['staff']);
    const notJson = await POST(
      request('/api/mcp', {
        method: 'POST',
        headers: { ...bearer(key), accept: 'application/json, text/event-stream' },
        raw: '{oops',
      }),
    );
    expect(notJson.status).toBe(400);
    expect((await json(notJson)).error.code).toBe(-32700);
    const unknown = await json(await mcp(key, rpc('resources/list')));
    expect(unknown.error.code).toBe(-32601);
    const wrongType = await POST(
      new Request('http://localhost:3000/api/mcp', {
        method: 'POST',
        headers: {
          ...bearer(key),
          'content-type': 'text/plain',
          accept: 'application/json, text/event-stream',
        },
        body: 'hi',
      }),
    );
    expect(wrongType.status).toBe(415);
  });
});
