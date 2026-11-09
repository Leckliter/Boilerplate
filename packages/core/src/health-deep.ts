import { getStorage } from './files/s3';
import { vapidFromEnv } from './notifications/push-sender';

/**
 * The "deep" health checks behind `GET /api/healthcheck?deep=1` (needs the CRON_SECRET): are the
 * outside services we depend on reachable and is our key accepted? NOTHING is sent — no email, no
 * text, no push — only read-only requests (list domains, list numbers, ask storage for a file that
 * does not exist). A service that is not configured here is reported as fine ("not configured"),
 * like a cron that never ran: preview deploys often have none. Names and timings only, no secrets.
 */
export type DeepCheck = { ok: boolean; detail: string };

const TIMEOUT_MS = 6_000;

function timed<T>(work: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no answer after ${ms / 1000} s`)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

const fail = (err: unknown): DeepCheck => ({
  ok: false,
  detail: String((err as Error)?.message ?? err).slice(0, 200),
});

export async function checkStorage(): Promise<DeepCheck> {
  const storage = getStorage();
  if (!storage) return { ok: true, detail: 'not configured' };
  const started = Date.now();
  try {
    // A missing object is a normal answer (null); a bad key, endpoint or bucket throws.
    await timed(storage.stat('private-files', 'healthcheck/does-not-exist'));
    return { ok: true, detail: `reachable (${Date.now() - started} ms)` };
  } catch (err) {
    return fail(err);
  }
}

export async function checkEmail(
  env: Record<string, string | undefined> = process.env,
  fetchFn: typeof fetch = fetch,
): Promise<DeepCheck> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return { ok: true, detail: 'not configured' };
  try {
    const res = await timed(
      fetchFn('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
    );
    if (res.ok) return { ok: true, detail: 'Resend reachable, key accepted' };
    let body: { name?: string } = {};
    try {
      body = (await res.json()) as { name?: string };
    } catch {
      // Expected: an error answer that is not JSON (e.g. a proxy's HTML page): judged by status alone.
    }
    // A sending-only key may not list domains; Resend then says so — the key itself is fine.
    if (res.status === 401 && body.name === 'restricted_api_key') {
      return { ok: true, detail: 'Resend reachable, sending-only key accepted' };
    }
    return { ok: false, detail: `Resend answered ${res.status} (is RESEND_API_KEY right?)` };
  } catch (err) {
    return fail(err);
  }
}

export async function checkSms(
  env: Record<string, string | undefined> = process.env,
  fetchFn: typeof fetch = fetch,
): Promise<DeepCheck> {
  if (!env.QUO_API_KEY || !env.QUO_FROM_NUMBER) return { ok: true, detail: 'not configured' };
  try {
    const base = env.QUO_API_BASE ?? 'https://api.openphone.com/v1';
    const res = await timed(
      fetchFn(`${base}/phone-numbers`, {
        headers: { Authorization: env.QUO_API_KEY },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
    );
    return res.ok
      ? { ok: true, detail: 'Quo reachable, key accepted' }
      : { ok: false, detail: `Quo answered ${res.status} (is QUO_API_KEY right?)` };
  } catch (err) {
    return fail(err);
  }
}

/** Push has no server to ping: check the VAPID keys are well-formed (a bad key only fails at send time). */
export function checkPush(env: Record<string, string | undefined> = process.env): DeepCheck {
  const any = env.VAPID_PUBLIC_KEY || env.VAPID_PRIVATE_KEY || env.VAPID_SUBJECT;
  const vapid = vapidFromEnv(env);
  if (!vapid) {
    return any
      ? {
          ok: false,
          detail: 'VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT must all be set',
        }
      : { ok: true, detail: 'not configured' };
  }
  const publicBytes = Buffer.from(vapid.publicKey, 'base64url').length;
  const privateBytes = Buffer.from(vapid.privateKey, 'base64url').length;
  if (publicBytes !== 65)
    return { ok: false, detail: 'VAPID_PUBLIC_KEY is not a valid key (65 bytes expected)' };
  if (privateBytes !== 32)
    return { ok: false, detail: 'VAPID_PRIVATE_KEY is not a valid key (32 bytes expected)' };
  if (!/^(mailto:|https:\/\/)/.test(vapid.subject)) {
    return { ok: false, detail: 'VAPID_SUBJECT must start with mailto: or https://' };
  }
  return { ok: true, detail: 'VAPID keys look valid' };
}

export function checkWebhooks(env: Record<string, string | undefined> = process.env): DeepCheck {
  const resend = Boolean(env.RESEND_WEBHOOK_SECRET);
  const quo = Boolean(env.QUO_WEBHOOK_SECRET);
  return {
    ok: true,
    detail: `Resend webhook secret ${resend ? 'set' : 'not set'}, Quo webhook secret ${quo ? 'set' : 'not set'}`,
  };
}

/** All deep checks, keyed `deep/<name>` so they merge into the normal health report. */
export async function deepHealthChecks(
  env: Record<string, string | undefined> = process.env,
  fetchFn: typeof fetch = fetch,
): Promise<Record<string, DeepCheck>> {
  const [storage, email, sms] = await Promise.all([
    checkStorage(),
    checkEmail(env, fetchFn),
    checkSms(env, fetchFn),
  ]);
  return {
    'deep/storage': storage,
    'deep/email': email,
    'deep/sms': sms,
    'deep/push': checkPush(env),
    'deep/webhooks': checkWebhooks(env),
  };
}
