import 'server-only';

import type { RequestInfo } from '@app/core';
import { headers } from 'next/headers';
import { cache } from 'react';

type HeaderSource = { get(name: string): string | null };

/**
 * Where a request came from, for the activity log and error reports. On
 * Vercel, `x-vercel-id` identifies the request in Vercel → Logs too, so a log
 * entry, an error report and the platform logs can be lined up.
 */
export function requestInfoFrom(h: HeaderSource, path?: string | null): RequestInfo {
  return {
    id: h.get('x-vercel-id') ?? h.get('x-request-id') ?? crypto.randomUUID(),
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null,
    userAgent: h.get('user-agent'),
    path: path ?? null,
    humanToken: h.get('x-turnstile-token'),
    idempotencyKey: h.get('idempotency-key'),
  };
}

/** Request info for the current server component, server action or route handler. Cached per request. */
export const currentRequestInfo = cache(async (): Promise<RequestInfo> => {
  const h = await headers();
  return requestInfoFrom(h, pathFromReferer(h));
});

/** Server actions don't know their page; the browser's Referer does. */
function pathFromReferer(h: HeaderSource): string | null {
  const referer = h.get('referer');
  if (!referer) return null;
  try {
    return new URL(referer).pathname;
  } catch {
    // Expected: a missing or malformed Referer.
    return null;
  }
}
