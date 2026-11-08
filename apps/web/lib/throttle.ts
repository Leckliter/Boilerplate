import 'server-only';

const buckets = new Map<string, { count: number; since: number }>();

/**
 * Simple per-server-instance limiter for endpoints anyone can call (error
 * reports, failed sign-in notes): true while `key` is under `limit` calls per
 * `windowMs`. Not a security boundary — it stops floods, not determined abuse.
 */
export function underLimit(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const seen = buckets.get(key);
  if (seen && now - seen.since < windowMs) return ++seen.count <= limit;
  if (buckets.size > 10_000) buckets.clear();
  buckets.set(key, { count: 1, since: now });
  return true;
}
