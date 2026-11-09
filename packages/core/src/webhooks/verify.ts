import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signature checks for incoming provider webhooks. All of them work on the RAW request body
 * (never a re-serialised JSON), compare in constant time and refuse timestamps outside a
 * tolerance (replay protection). Each returns `{ ok: true }` or `{ ok: false, reason }`; the
 * reason is for our logs, never for the sender.
 */
export type Verdict = { ok: true } | { ok: false; reason: string };

/** Webhooks older (or further in the future) than this are refused. */
export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Unix seconds, or milliseconds (Quo): both accepted. */
function toSeconds(ts: string): number | null {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 1e11 ? n / 1000 : n;
}

function withinTolerance(ts: string, now: Date, toleranceSeconds: number): Verdict {
  const seconds = toSeconds(ts);
  if (seconds === null) return { ok: false, reason: 'Unreadable timestamp.' };
  if (Math.abs(now.getTime() / 1000 - seconds) > toleranceSeconds) {
    return { ok: false, reason: 'Timestamp outside the allowed window (replay?).' };
  }
  return { ok: true };
}

/**
 * Svix signatures (what Resend uses): headers `svix-id`, `svix-timestamp`, `svix-signature`
 * (`v1,<base64> v1,<base64>` — several while a secret is rotating). The signing key is the part
 * of the secret after `whsec_`, base64-decoded; the signed text is `<id>.<timestamp>.<body>`.
 */
export function verifySvix(input: {
  secret: string;
  headers: { get(name: string): string | null };
  body: string;
  now?: Date;
  toleranceSeconds?: number;
}): Verdict {
  const id = input.headers.get('svix-id');
  const timestamp = input.headers.get('svix-timestamp');
  const signature = input.headers.get('svix-signature');
  if (!id || !timestamp || !signature) return { ok: false, reason: 'Missing svix-* headers.' };
  const fresh = withinTolerance(
    timestamp,
    input.now ?? new Date(),
    input.toleranceSeconds ?? WEBHOOK_TOLERANCE_SECONDS,
  );
  if (!fresh.ok) return fresh;
  const key = Buffer.from(input.secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${input.body}`)
    .digest('base64');
  const candidates = signature
    .split(' ')
    .map((p) => p.split(',') as [string, string])
    .filter(([version, sig]) => version === 'v1' && sig);
  return candidates.some(([, sig]) => same(sig, expected))
    ? { ok: true }
    : { ok: false, reason: 'Signature does not match.' };
}

/**
 * Quo (OpenPhone) webhooks. Their `openphone-signature` header looks like
 * `hmac;1;<timestamp>;<base64 digest>`: HMAC-SHA256, keyed with the base64-decoded signing key
 * shown when the webhook is created (our QUO_WEBHOOK_SECRET), over `<timestamp>.<raw body>`.
 *
 * Without that header (a proxy, or a plan that cannot sign) a shared secret is accepted instead
 * in the `x-webhook-secret` header — set the same QUO_WEBHOOK_SECRET value there. Either way,
 * nothing is accepted unless QUO_WEBHOOK_SECRET is set.
 */
export function verifyQuo(input: {
  secret: string;
  headers: { get(name: string): string | null };
  body: string;
  now?: Date;
  toleranceSeconds?: number;
}): Verdict {
  const signed = input.headers.get('openphone-signature');
  if (signed) {
    const [scheme, version, timestamp, digest] = signed.split(';');
    if (scheme !== 'hmac' || version !== '1' || !timestamp || !digest) {
      return { ok: false, reason: 'Unreadable openphone-signature header.' };
    }
    const fresh = withinTolerance(
      timestamp,
      input.now ?? new Date(),
      input.toleranceSeconds ?? WEBHOOK_TOLERANCE_SECONDS,
    );
    if (!fresh.ok) return fresh;
    const expected = createHmac('sha256', Buffer.from(input.secret, 'base64'))
      .update(`${timestamp}.${input.body}`)
      .digest('base64');
    return same(digest, expected)
      ? { ok: true }
      : { ok: false, reason: 'Signature does not match.' };
  }
  const shared = input.headers.get('x-webhook-secret');
  if (shared && same(shared, input.secret)) return { ok: true };
  return { ok: false, reason: 'No valid openphone-signature or x-webhook-secret header.' };
}
