import {
  type Actor,
  getAppEnv,
  hasPermission,
  listActions,
  logger,
  reportError,
  runAction,
} from '@app/core';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
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
 * Transport: the official `@modelcontextprotocol/sdk`, "Streamable HTTP", STATELESS (a fresh server
 * and transport per request, JSON responses, no sessions — right for serverless). The tool list is
 * built from the action registry (`toolsFor`) with plain JSON Schema, so the SDK's low-level
 * `Server` is used instead of `McpServer` (which wants zod shapes).
 */
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
            inputSchema: { type: 'object' as const, ...inputSchema },
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
  'with automations_run, then automations_update enabled=true. docs_list / docs_get read the in-app docs. ' +
  'search_query searches contacts, docs, automations and more at once.';

/** One MCP server bound to the caller: lists and runs only what this key's owner may. */
function serverFor(actor: Actor, req: Request) {
  const server = new Server(
    { name: `app-${getAppEnv()}`, version: '1.0.0' },
    { capabilities: { tools: { listChanged: false } }, instructions: INSTRUCTIONS },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolsFor(actor).map((t) => t.tool),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const found = toolsFor(actor).find((t) => t.tool.name === name);
    if (!found) throw new McpError(ErrorCode.InvalidParams, `Unknown tool "${name}".`);
    const { idempotencyKey, ...rest } = (request.params.arguments ?? {}) as {
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
    // runAction re-checks permissions, validates the input and logs the call (denied attempts too).
    const result = await runAction(found.action.name, rest, callActor);
    if (found.action.mutates) runJobsAfterResponse();
    return {
      isError: !result.ok,
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result.ok ? result.data : result.error, null, 2),
        },
      ],
    };
  });
  return server;
}

const rpcError = (code: number, message: string) => ({
  jsonrpc: '2.0',
  id: null,
  error: { code, message },
});

/** curl users forget `Accept: application/json, text/event-stream`; the SDK insists on it, so add it. */
function withAcceptHeader(req: Request): Request {
  const accept = req.headers.get('accept') ?? '';
  if (accept.includes('application/json') && accept.includes('text/event-stream')) return req;
  const headers = new Headers(req.headers);
  headers.set('accept', 'application/json, text/event-stream');
  return new Request(req, { headers });
}

export async function POST(req: Request) {
  const actor = await actorFromRequest(req, 'mcp');
  // MCP needs an API key; a signed-out visitor or a cookie session is not an AI client.
  if (!actor || actor.kind !== 'api_key') {
    return new Response(
      JSON.stringify(rpcError(-32001, 'Send a valid API key as a Bearer token.')),
      {
        status: 401,
        headers: { 'content-type': 'application/json', 'www-authenticate': 'Bearer' },
      },
    );
  }
  const log = logger({ source: 'mcp', requestId: actor.request?.id });
  const server = serverFor(actor, req);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
    maxRequestBodySize: 1_000_000,
  });
  try {
    await server.connect(transport);
    return await transport.handleRequest(withAcceptHeader(req));
  } catch (err) {
    // Not an action failure (those come back as tool results): the transport itself broke.
    const ref = await reportError(err, {
      source: 'request',
      actor,
      context: { where: 'mcp transport' },
    });
    log.error('transport failed', { ref, err });
    return Response.json(rpcError(-32603, `Internal error. Error reference: ${ref}`), {
      status: 500,
    });
  } finally {
    // Stateless: nothing outlives the request; closing only releases the per-request objects.
    try {
      await server.close();
    } catch {
      // Expected: the transport may already be closed after a one-shot JSON response.
    }
  }
}

// Streamable HTTP clients may open a GET stream or DELETE a session; this server has neither.
const notSupported = () => new Response(null, { status: 405, headers: { allow: 'POST' } });
export { notSupported as GET, notSupported as DELETE };
