import 'server-only';

import {
  type Actor,
  actorFromApiKey,
  guestActor,
  reportError,
  runDueJobs,
  withRequest,
} from '@app/core';
import { after } from 'next/server';

import { requestInfoFrom } from '@/lib/request-info';
import { getActor } from '@/lib/viewer';

/** HTTP status for each action error code. */
export const STATUS: Record<string, number> = {
  unauthenticated: 401,
  forbidden: 403,
  invalid_input: 400,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  unknown_action: 404,
  internal: 500,
};

export const bearerOf = (req: Request): string | null => {
  const header = req.headers.get('authorization') ?? '';
  return /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, '').trim() : null;
};

/**
 * Who is calling: the owner of the `Authorization: Bearer app_sk_…` key (REST `api`, MCP `mcp`),
 * or — for the site's own pages calling with a cookie — the signed-in person. No credentials =
 * a guest (public actions only). A bearer token that does not match a live key is `null`:
 * answer 401, never fall back to a guest.
 */
export async function actorFromRequest(
  req: Request,
  channel: 'api' | 'mcp',
): Promise<Actor | null> {
  const path = new URL(req.url).pathname;
  const token = bearerOf(req);
  if (token) {
    const actor = await actorFromApiKey(token, channel);
    return actor ? withRequest(actor, requestInfoFrom(req.headers, path)) : null;
  }
  // Cookie callers are the site's own pages: same actor as a server action.
  const viewer = await getActor();
  return viewer.kind === 'guest'
    ? withRequest(guestActor(channel), requestInfoFrom(req.headers, path))
    : viewer;
}

/** Jobs a change queued (notifications, event dispatch, file deletes) run right after the response. */
export function runJobsAfterResponse() {
  after(async () => {
    try {
      await runDueJobs({ limit: 10, deadlineMs: 20_000 });
    } catch (err) {
      await reportError(err, { source: 'job', context: { where: 'api after()' } });
    }
  });
}

/** Browser (cookie) callers must send same-origin JSON: blocks cross-site form posts. */
export function isSameOriginJson(req: Request) {
  const type = req.headers.get('content-type') ?? '';
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!type.toLowerCase().startsWith('application/json') || !origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    // Expected: an unparseable Origin header simply is not ours.
    return false;
  }
}
