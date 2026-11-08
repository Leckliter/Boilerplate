import { getDb, rateLimitHits, sql } from '@app/db';

import type { Actor } from './access';

/** At most `limit` calls per `perSeconds`, counted per caller (person, API key or IP address). */
export type RateLimit = { limit: number; perSeconds: number };

/**
 * Who a limit is counted against: the signed-in person, the API key, or —
 * for guests — the IP address. The system (crons, webhooks) is never limited,
 * and neither is server code with no request to attribute (e.g. a script).
 */
export function rateLimitCaller(actor: Actor): string | null {
  if (actor.kind === 'system') return null;
  if (actor.apiKeyId) return `key:${actor.apiKeyId}`;
  if (actor.contactId) return `contact:${actor.contactId}`;
  return actor.request?.ip ? `ip:${actor.request.ip}` : null;
}

/**
 * Count one call against `bucket` and say whether it's allowed. Fixed
 * windows: the count resets at each multiple of `perSeconds`. Runs in its own
 * statement (outside any action transaction) so refused and failed calls
 * count too.
 */
export async function takeRateLimit(
  bucket: string,
  { limit, perSeconds }: RateLimit,
  now = new Date(),
): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> {
  const windowMs = perSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const [row] = await getDb()
    .insert(rateLimitHits)
    .values({ key: bucket, windowStart })
    .onConflictDoUpdate({
      target: [rateLimitHits.key, rateLimitHits.windowStart],
      set: { hits: sql`${rateLimitHits.hits} + 1` },
    })
    .returning({ hits: rateLimitHits.hits });
  if ((row?.hits ?? 0) <= limit) return { allowed: true };
  return {
    allowed: false,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000),
    ),
  };
}
