import { runAction } from '@app/core';

import {
  actorFromRequest,
  bearerOf,
  isSameOriginJson,
  runJobsAfterResponse,
  STATUS,
} from '../../_lib/request';

/**
 * POST /api/v1/actions/<name> with a JSON body = the action's input.
 *
 *   curl -X POST https://example.com/api/v1/actions/contacts.list \
 *     -H "Authorization: Bearer app_sk_…" -H "Content-Type: application/json" \
 *     -d '{"tag":"customer"}'
 *
 * Responds `{ ok: true, data }` or `{ ok: false, error: { code, message, ref? } }`. Rate-limited
 * calls get HTTP 429 with `Retry-After`. Guests send the Turnstile token for `humanCheck` actions in
 * the `x-turnstile-token` header. Changes accept an `Idempotency-Key` header (e.g. a UUID):
 * sending the same request again with the same key within 24 hours returns the first result (with
 * `Idempotent-Replayed: true`) instead of making the change twice.
 */
export async function POST(req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const fail = (status: number, code: string, message: string) =>
    Response.json({ ok: false, error: { code, message } }, { status });

  if (!bearerOf(req) && !isSameOriginJson(req)) {
    return fail(403, 'forbidden', 'Use an API key, or call from this site with JSON.');
  }
  const actor = await actorFromRequest(req, 'api');
  if (!actor) return fail(401, 'unauthenticated', 'Invalid, expired or revoked API key.');

  let input: unknown = {};
  const text = await req.text();
  if (text) {
    try {
      input = JSON.parse(text);
    } catch {
      // Expected: the caller sent something that is not JSON.
      return fail(400, 'invalid_input', 'Body must be JSON.');
    }
  }
  const result = await runAction(name, input, actor);
  runJobsAfterResponse();
  const retryAfter =
    !result.ok &&
    (result.error.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
  const headers: Record<string, string> = {};
  if (retryAfter) headers['Retry-After'] = String(retryAfter);
  if (result.ok && result.replayed) headers['Idempotent-Replayed'] = 'true';
  return Response.json(result, {
    status: result.ok ? 200 : (STATUS[result.error.code] ?? 400),
    headers,
  });
}
