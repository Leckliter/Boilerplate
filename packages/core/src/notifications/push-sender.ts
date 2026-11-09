import { sendNotification } from 'web-push';

import type { PushResult, PushTarget } from './senders';

/**
 * The real Web Push sender (docs/notifications.md → Push). Needs VAPID_PUBLIC_KEY,
 * VAPID_PRIVATE_KEY and VAPID_SUBJECT (a `mailto:` or `https:` URL); without them every push
 * is reported as "not set up" and recorded as skipped. Generate keys once with
 * `npx web-push generate-vapid-keys`.
 *
 * Mapping of the push service's answers: 201/2xx = sent; 404 / 410 = the browser unsubscribed
 * (`gone`: the dispatcher deletes that subscription); anything else = failed, so it is retried
 * with backoff like every other channel.
 */
export type VapidKeys = { publicKey: string; privateKey: string; subject: string };

export function vapidFromEnv(
  env: Record<string, string | undefined> = process.env,
): VapidKeys | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  const subject = env.VAPID_SUBJECT?.trim();
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

/** The public key the browser needs for `pushManager.subscribe`, or null when push isn't set up. */
export function pushPublicKey(
  env: Record<string, string | undefined> = process.env,
): string | null {
  return vapidFromEnv(env)?.publicKey ?? null;
}

type SendFn = (
  target: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  options: { TTL: number; urgency: 'normal'; vapidDetails: VapidKeys; timeout: number },
) => Promise<unknown>;

/** `send` is injectable so tests never touch the network. */
export function createWebPushSender(
  send: SendFn = (t, p, o) =>
    sendNotification(t, p, {
      TTL: o.TTL,
      urgency: o.urgency,
      timeout: o.timeout,
      vapidDetails: {
        subject: o.vapidDetails.subject,
        publicKey: o.vapidDetails.publicKey,
        privateKey: o.vapidDetails.privateKey,
      },
    }),
  env: () => Record<string, string | undefined> = () => process.env,
): (target: PushTarget, payload: string) => Promise<PushResult> {
  return async (target, payload) => {
    const vapid = vapidFromEnv(env());
    if (!vapid) return { status: 'not_configured' };
    try {
      await send(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        payload,
        { TTL: 24 * 60 * 60, urgency: 'normal', vapidDetails: vapid, timeout: 15_000 },
      );
      return { status: 'sent', providerId: '' };
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return { status: 'gone' };
      return {
        status: 'failed',
        error: `Push service answered ${status ?? 'with an error'}: ${String((err as Error)?.message ?? err).slice(0, 200)}`,
      };
    }
  };
}

export const webPushSender = createWebPushSender();
