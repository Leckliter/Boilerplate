import { getAppEnv, hasPermission, listActions } from '@app/core';
import { z } from 'zod';

import { actorFromRequest } from '../_lib/request';

/**
 * GET /api/v1/openapi.json — an OpenAPI 3.1 description of the actions the caller may run, generated
 * from the actions' zod schemas (so it cannot drift). Send your API key to see everything the key
 * may do; without one you see the public actions.
 */
export async function GET(req: Request) {
  const actor = await actorFromRequest(req, 'api');
  if (!actor) {
    return Response.json(
      {
        ok: false,
        error: { code: 'unauthenticated', message: 'Invalid, expired or revoked API key.' },
      },
      { status: 401 },
    );
  }
  const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: 'input', unrepresentable: 'any' });
  const paths = Object.fromEntries(
    listActions()
      .filter((a) => hasPermission(actor, a.audience))
      .map((a) => [
        `/api/v1/actions/${a.name}`,
        {
          post: {
            operationId: a.name.replace(/\./g, '_'),
            summary: a.title,
            description: `${a.description}\n\nReturns: ${a.returns}\nWho: ${a.audience}`,
            tags: [a.name.split('.')[0]],
            ...(a.destructive && { 'x-destructive': true }),
            parameters: a.mutates
              ? [
                  {
                    name: 'Idempotency-Key',
                    in: 'header',
                    required: false,
                    description:
                      'Repeat a change safely: the same key within 24 h returns the first result.',
                    schema: { type: 'string', maxLength: 255 },
                  },
                ]
              : [],
            requestBody: {
              required: false,
              content: { 'application/json': { schema: schema(a.input) } },
            },
            responses: {
              '200': {
                description: 'Ok. The body is `{ ok: true, data }`.',
                content: {
                  'application/json': { schema: { $ref: '#/components/schemas/Result' } },
                },
              },
              '400': { description: 'invalid_input', content: errorContent },
              '401': { description: 'unauthenticated', content: errorContent },
              '403': { description: 'forbidden', content: errorContent },
              '404': { description: 'not_found', content: errorContent },
              '409': { description: 'conflict', content: errorContent },
              '429': { description: 'rate_limited (see Retry-After)', content: errorContent },
              '500': {
                description: 'internal (the error has a `ref`, see errors.get)',
                content: errorContent,
              },
            },
          },
        },
      ]),
  );
  return Response.json({
    openapi: '3.1.0',
    info: {
      title: `API (${getAppEnv()})`,
      version: '1.0.0',
      description:
        'Every action of the app. POST JSON to /api/v1/actions/<name> with `Authorization: Bearer app_sk_…`.',
    },
    servers: [{ url: new URL(req.url).origin }],
    security: [{ bearer: [] }],
    paths,
    components: {
      securitySchemes: {
        bearer: { type: 'http', scheme: 'bearer', description: 'An API key (app_sk_…).' },
      },
      schemas: {
        Result: {
          oneOf: [
            {
              type: 'object',
              required: ['ok', 'data'],
              properties: { ok: { const: true }, data: {} },
            },
            { $ref: '#/components/schemas/Error' },
          ],
        },
        Error: {
          type: 'object',
          required: ['ok', 'error'],
          properties: {
            ok: { const: false },
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                ref: { type: 'string', description: 'Error reference, e.g. E-7K3QX9MD' },
              },
            },
          },
        },
      },
    },
  });
}

const errorContent = {
  'application/json': { schema: { $ref: '#/components/schemas/Error' } },
};
