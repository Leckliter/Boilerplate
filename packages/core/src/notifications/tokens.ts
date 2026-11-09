import { createHmac, timingSafeEqual } from 'node:crypto';

import { isProduction } from '../env';

/**
 * Signed links in emails (unsubscribe, manage preferences) that work without
 * signing in. A token names one contact and one notification type; it can't be
 * forged without NOTIFICATIONS_SECRET.
 */
type Payload = { c: string; t: string };

function secret(): string {
  const s = process.env.NOTIFICATIONS_SECRET;
  if (s) return s;
  if (isProduction()) throw new Error('NOTIFICATIONS_SECRET is not set.');
  return 'local-development-only-notifications-secret';
}

export function signUnsubscribe(contactId: string, type: string): string {
  const body = Buffer.from(JSON.stringify({ c: contactId, t: type } satisfies Payload)).toString(
    'base64url',
  );
  return `${body}.${mac(body)}`;
}

export function verifyUnsubscribe(token: string): Payload | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = Buffer.from(mac(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as Payload;
    return typeof p.c === 'string' && typeof p.t === 'string' ? p : null;
  } catch {
    // Expected: a tampered or truncated token is simply invalid.
    return null;
  }
}

const mac = (body: string) => createHmac('sha256', secret()).update(body).digest('base64url');

// ---------------------------------------------------------------- purpose-bound links

/**
 * A signed, expiring link token for one thing (`kind`) about one subject, e.g. confirming a
 * newsletter subscription. The kind is part of the signature, so a token made for one purpose
 * never works for another (nor as an unsubscribe token).
 */
type LinkPayload = { k: string; s: string; e: number };

export function signLink(kind: string, subject: string, ttlMs: number, now = new Date()): string {
  const body = Buffer.from(
    JSON.stringify({ k: kind, s: subject, e: now.getTime() + ttlMs } satisfies LinkPayload),
  ).toString('base64url');
  return `${body}.${mac(body)}`;
}

/** The subject the token was made for, or null when it is forged, for another kind, or expired. */
export function verifyLink(kind: string, token: string, now = new Date()): string | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = Buffer.from(mac(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as LinkPayload;
    if (p.k !== kind || typeof p.s !== 'string' || typeof p.e !== 'number') return null;
    return p.e >= now.getTime() ? p.s : null;
  } catch {
    // Expected: a tampered or truncated token is simply invalid.
    return null;
  }
}
