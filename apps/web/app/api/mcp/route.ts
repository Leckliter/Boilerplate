import { type Actor, getAppEnv, hasPermission, listActions, runAction } from '@app/core';
import { z } from 'zod';

import { actorFromRequest, runJobsAfterResponse } from '../v1/_lib/request';

/**
 * MCP server for AI assistants (Claude, ChatGPT, Cursor …): `POST /api/mcp` with
 * `Authorization: Bearer app_sk_…` (create a key in /admin/api-keys).
 *
 * Every action the key's owner may run is a tool (dots → underscores: contacts.create →
 * contacts_create). Same validation, permissions and activity log as the admin app, so an AI can
 * never do more than its owner. Changes take an optional `idempotencyKey` argument.
 *
 * This is a small stateless implementation of MCP's "Streamable HTTP" transport (JSON responses,
 * no sessions): `initialize`, `ping`, `tools/list` and `tools/call` — all an assistant needs. To use
 * the official SDK or `mcp-handler` instead, replace this file; the tools come from `toolsFor(actor)`.
 */
const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const toolName = (action: string) => action.replace(/\./g, '_');

const idempotencyKeyProperty = {
  type: 'string',
  minLength: 1,
  maxLength: 255,
  description:
    'Optional. A unique id (e.g. a UUID) for this change. If you are unsure whether a call went through, ' +
    'repeat it with the SAME idempotencyKey: you get the first result instead of a second change.',
};

function toolsFor(actor: Actor) {
  return (
    listActions()
      // Website-only (public) and system-only actions are not AI tools; neither are ones this key may not run.
      .filter(
        (a) =>
          a.audience !== 'public' && a.audience !== 'system' && hasPermission(actor, a.audience),
      )
      .map((a) => {
        const schema = z.toJSONSchema(a.input, { io: 'input', unrepresentable: 'any' }) as {
          type?: string;
          properties?: Record<string, unknown>;
        };
        const inputSchema =
          a.mutates && schema.type === 'object'
            ? {
                ...schema,
                properties: { ...schema.properties, idempotencyKey: idempotencyKeyProperty },
              }
            : schema;
        return {
          action: a,
          tool: {
            name: toolName(a.name),
            title: a.title,
            description: `${a.description}\n\nReturns: ${a.returns}\nRequires: ${a.audience}`,
            inputSchema,
            annotations: { readOnlyHint: !a.mutates, destructiveHint: Boolean(a.destructive) },
          },
        };
      })
  );
}

const INSTRUCTIONS =
  'Business system. Start with system_whoami to see your permissions. Contacts are everyone the business ' +
  'deals with; what they are is a tag (use tags_list). Every call you make (reads included) is recorded in the ' +
  'activity log under your API key. If a tool fails with code "internal", the result has a `ref` like E-7K3QX9MD: ' +
  'call errors_get with it (owner/admin keys) for the full error report and a diagnosis. Automations ' +
  '(owner/admin keys): call automations_reference first, create with automations_create (they start off), test ' +
  'with automations_run, then automations_update enabled=true. docs_list / docs_get read the in-app docs.';

type Rpc = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

const reply = (id: Rpc['id'], result: unknown) => ({ jsonrpc: '2.0', id: id ?? null, result });
const rpcError = (id: Rpc['id'], code: number, message: string) => ({
  jsonrpc: '2.0',
  id: id ?? null,
  error: { code, message },
});

async function handle(msg: Rpc, actor: Actor, req: Request) {
  const id = msg.id;
  // Notifications (no id) are acknowledged by the transport with 202, never answered.
  if (id === undefined) return null;
  switch (msg.method) {
    case 'initialize': {
      const wanted = String(msg.params?.protocolVersion ?? '');
      return reply(id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(wanted) ? wanted : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: `app-${getAppEnv()}`, version: '1.0.0' },
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return reply(id, {});
    case 'tools/list':
      return reply(id, { tools: toolsFor(actor).map((t) => t.tool) });
    case 'tools/call': {
      const name = String(msg.params?.name ?? '');
      const found = toolsFor(actor).find((t) => t.tool.name === name);
      if (!found) return rpcError(id, -32602, `Unknown tool "${name}".`);
      const { idempotencyKey, ...rest } = (msg.params?.arguments ?? {}) as {
        idempotencyKey?: string;
      };
      // Per tool call, never per HTTP request (one request can carry many calls).
      const callActor: Actor = {
        ...actor,
        request: {
          ...(actor.request ?? { id: crypto.randomUUID(), path: new URL(req.url).pathname }),
          idempotencyKey: found.action.mutates ? (idempotencyKey ?? null) : null,
        },
      };
      // runAction re-checks permissions and logs the call (denied attempts too).
      const result = await runAction(found.action.name, rest, callActor);
      if (found.action.mutates) runJobsAfterResponse();
      return reply(id, {
        isError: !result.ok,
        content: [
          { type: 'text', text: JSON.stringify(result.ok ? result.data : result.error, null, 2) },
        ],
      });
    }
    default:
      return rpcError(id, -32601, `Method not found: ${msg.method}`);
  }
}

export async function POST(req: Request) {
  const actor = await actorFromRequest(req, 'mcp');
  // MCP needs an API key; a signed-out visitor or a cookie session is not an AI client.
  if (!actor || actor.kind !== 'api_key') {
    return new Response(
      JSON.stringify(rpcError(null, -32001, 'Send a valid API key as a Bearer token.')),
      {
        status: 401,
        headers: { 'content-type': 'application/json', 'www-authenticate': 'Bearer' },
      },
    );
  }
  let body: Rpc | Rpc[];
  try {
    body = (await req.json()) as Rpc | Rpc[];
  } catch {
    // Expected: the client sent something that is not JSON.
    return Response.json(rpcError(null, -32700, 'Parse error: body must be JSON.'), {
      status: 400,
    });
  }
  const batch = Array.isArray(body);
  const responses = (
    await Promise.all((Array.isArray(body) ? body : [body]).map((m) => handle(m, actor, req)))
  ).filter((r) => r !== null);
  if (responses.length === 0) return new Response(null, { status: 202 });
  return Response.json(batch ? responses : responses[0]);
}

// Streamable HTTP clients may open a GET stream or DELETE a session; this server has neither.
const notSupported = () => new Response(null, { status: 405, headers: { allow: 'POST' } });
export { notSupported as GET, notSupported as DELETE };
