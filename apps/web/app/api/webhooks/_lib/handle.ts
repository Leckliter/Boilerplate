import 'server-only';

import { logger, reportError, systemActor, type ActionResult, withRequest } from '@app/core';
import type { Verdict } from '@app/core/webhooks';

import { requestInfoFrom } from '@/lib/request-info';

import { runJobsAfterResponse } from '../../v1/_lib/request';

/** Bodies bigger than this are refused before anything is parsed (providers send a few KB). */
export const MAX_WEBHOOK_BYTES = 1_000_000;

type Headers = { get(name: string): string | null };

/**
 * What every provider webhook route does, in one place — the route files only say which provider:
 *
 * 1. no secret configured → 503 (the provider retries later; nothing is accepted unsigned);
 * 2. read the RAW body (signatures are over the exact bytes), refuse anything huge (413);
 * 3. verify the signature + timestamp → 401 (replays and forgeries; the reason is only logged);
 * 4. parse JSON and map it to the action input → 400 when unreadable;
 * 5. run the system action (it dedupes by the provider's event id, so a retry is harmless) → 200;
 * 6. an unexpected failure is reported with `reportError` and answered 500, so the provider retries.
 */
export async function handleWebhook(
  req: Request,
  opts: {
    provider: string;
    secret: string | undefined;
    verify: (input: { secret: string; headers: Headers; body: string }) => Verdict;
    /** Raw JSON → the action's input, or null when it isn't an event we can read. */
    toInput: (
      json: unknown,
      headers: Headers,
    ) => { eventId: string; type: string; data: Record<string, unknown> } | null;
    run: (
      input: { eventId: string; type: string; data: Record<string, unknown> },
      actor: ReturnType<typeof systemActor>,
    ) => Promise<ActionResult<unknown>>;
  },
): Promise<Response> {
  const path = new URL(req.url).pathname;
  const info = requestInfoFrom(req.headers, path);
  const log = logger({ source: `webhook.${opts.provider}`, requestId: info.id });
  const reply = (status: number, body: Record<string, unknown>) => Response.json(body, { status });
  try {
    if (!opts.secret) {
      log.warn('refused: no signing secret configured');
      return reply(503, { ok: false, error: `${opts.provider} webhooks are not configured here.` });
    }
    const declared = Number(req.headers.get('content-length') ?? 0);
    if (declared > MAX_WEBHOOK_BYTES) return reply(413, { ok: false, error: 'Too large.' });
    const body = await req.text();
    if (body.length > MAX_WEBHOOK_BYTES) return reply(413, { ok: false, error: 'Too large.' });

    const verdict = opts.verify({ secret: opts.secret, headers: req.headers, body });
    if (!verdict.ok) {
      log.warn('refused: bad signature', { reason: verdict.reason, ip: info.ip });
      return reply(401, { ok: false, error: 'Invalid signature.' });
    }
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      // Expected: signed but not JSON — nothing a retry would fix.
      log.warn('refused: body is not JSON');
      return reply(400, { ok: false, error: 'Body must be JSON.' });
    }
    const input = opts.toInput(json, req.headers);
    if (!input) {
      log.warn('refused: unreadable event');
      return reply(400, { ok: false, error: 'Unreadable event.' });
    }
    const result = await opts.run(input, withRequest(systemActor('system'), info));
    if (!result.ok) {
      log.error('action failed', {
        type: input.type,
        eventId: input.eventId,
        code: result.error.code,
        ref: result.error.ref,
      });
      // internal = already reported (ref); retry. invalid_input = a payload we cannot use; don't retry.
      return reply(result.error.code === 'invalid_input' ? 400 : 500, {
        ok: false,
        error: result.error.message,
      });
    }
    runJobsAfterResponse();
    log.info('handled', { type: input.type, eventId: input.eventId, result: result.data });
    return reply(200, { ok: true, result: result.data });
  } catch (err) {
    const ref = await reportError(err, {
      source: 'webhook',
      request: info,
      context: { provider: opts.provider },
    });
    log.error('crashed', { ref, err });
    return reply(500, { ok: false, error: ref });
  }
}
