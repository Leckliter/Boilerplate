import { hasPermission, listActions } from '@app/core';
import { z } from 'zod';

import { actorFromRequest } from '../_lib/request';

/**
 * GET /api/v1/actions — the catalog of actions the caller may run, with JSON Schemas for their
 * inputs. Call with `Authorization: Bearer app_sk_…` (see /admin/api-keys). Machine-readable
 * OpenAPI-style version: /api/v1/openapi.json.
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
  const actions = listActions()
    .filter((a) => hasPermission(actor, a.audience))
    .map((a) => ({
      name: a.name,
      title: a.title,
      description: a.description,
      audience: a.audience,
      mutates: a.mutates,
      returns: a.returns,
      endpoint: `/api/v1/actions/${a.name}`,
      inputSchema: z.toJSONSchema(a.input, { io: 'input', unrepresentable: 'any' }),
    }));
  return Response.json({ actor: { kind: actor.kind, contactId: actor.contactId }, actions });
}
