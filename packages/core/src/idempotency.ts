import { createHash } from 'node:crypto';

import { and, eq, idempotencyKeys, lt, type Tx } from '@app/db';

import type { Actor } from './access';
import { rateLimitCaller } from './rate-limit';

/**
 * Idempotency keys: an API/AI client that isn't sure a change went through
 * (timeout, dropped connection) can send the same request again with the same
 * `Idempotency-Key` and get the first result back instead of a second change.
 *
 * - Only for changes (`mutates`), only when the caller sends a key.
 * - Remembered for 24 hours per caller (API key, person, or guest IP).
 * - Same key with a different action or input → `conflict`.
 * - Only successes are remembered: a failed call changed nothing, so it can
 *   simply be retried.
 *
 * runAction claims the key inside the action's own transaction, so a second
 * request with the same key waits for the first to commit (or roll back) —
 * the change can't happen twice even when both arrive at once.
 */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60_000;

export type IdempotencyClaim = { caller: string; key: string; action: string; requestHash: string };

export function idempotencyClaim(
  actor: Actor,
  action: string,
  input: unknown,
): IdempotencyClaim | null {
  const key = actor.request?.idempotencyKey;
  // The system has no rate-limit identity; its keys (automation steps) get their own space.
  const caller = actor.kind === 'system' ? `system:${actor.channel}` : rateLimitCaller(actor);
  if (!key || !caller) return null;
  return { caller, key, action, requestHash: hashInput(input) };
}

/** Valid keys: 1–255 visible characters (a UUID is ideal). */
export const isValidIdempotencyKey = (key: string) => /^[\x21-\x7e]{1,255}$/.test(key);

export type ClaimOutcome =
  | { kind: 'claimed' }
  | { kind: 'replay'; response: unknown }
  | { kind: 'mismatch' }
  | { kind: 'in_progress' };

/** Claim the key for this request, or find what the first request with it did. */
export async function claimIdempotencyKey(
  tx: Tx,
  claim: IdempotencyClaim,
  now = new Date(),
): Promise<ClaimOutcome> {
  const match = and(eq(idempotencyKeys.caller, claim.caller), eq(idempotencyKeys.key, claim.key));
  // An expired key is free again.
  await tx
    .delete(idempotencyKeys)
    .where(and(match, lt(idempotencyKeys.createdAt, new Date(now.getTime() - IDEMPOTENCY_TTL_MS))));
  const inserted = await tx
    .insert(idempotencyKeys)
    .values({ ...claim, createdAt: now })
    .onConflictDoNothing()
    .returning({ key: idempotencyKeys.key });
  if (inserted.length) return { kind: 'claimed' };
  const [previous] = await tx.select().from(idempotencyKeys).where(match);
  if (!previous) return { kind: 'in_progress' };
  if (previous.action !== claim.action || previous.requestHash !== claim.requestHash) {
    return { kind: 'mismatch' };
  }
  if (previous.response === null) return { kind: 'in_progress' };
  return { kind: 'replay', response: (previous.response as { data: unknown }).data };
}

export async function saveIdempotentResponse(
  tx: Pick<Tx, 'update'>,
  claim: IdempotencyClaim,
  response: unknown,
) {
  await tx
    .update(idempotencyKeys)
    // Wrapped, so an action that returns nothing still reads as "finished".
    .set({ response: { data: toJson(response) } })
    .where(and(eq(idempotencyKeys.caller, claim.caller), eq(idempotencyKeys.key, claim.key)));
}

/** What the result looks like once it has been through JSON (as the API returns it). */
function toJson(value: unknown): unknown {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

function hashInput(input: unknown) {
  return createHash('sha256').update(stableStringify(input)).digest('hex');
}

/** JSON with object keys sorted, so {a,b} and {b,a} hash the same. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value)
    .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}
