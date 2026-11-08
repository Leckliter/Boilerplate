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
