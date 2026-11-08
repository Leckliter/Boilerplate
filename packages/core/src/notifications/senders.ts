import { sendEmail, sendSms, type SendResult } from '../messaging';

/**
 * How each channel actually goes out. Email and SMS go through `@app/core/messaging` (so the
 * test-recipient guard applies). Push is a STUB: it reports `not_configured` until you plug in a
 * Web Push sender with `setPushSender` (docs/notifications.md → Push). Tests swap all three with
 * `setSendersForTests`.
 */
export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushResult = SendResult | { status: 'gone' };

export type Senders = {
  email: (msg: Parameters<typeof sendEmail>[0]) => Promise<SendResult>;
  sms: (msg: { to: string; content: string; from?: string }) => Promise<SendResult>;
  push: (target: PushTarget, payload: string) => Promise<PushResult>;
};

const pushStub: Senders['push'] = async () => ({ status: 'not_configured' });

let pushSender: Senders['push'] = pushStub;
let override: Senders | null = null;

export const senders = (): Senders =>
  override ?? { email: sendEmail, sms: sendSms, push: pushSender };

/**
 * Plug in real Web Push, e.g. with the `web-push` package and your VAPID keys:
 * `setPushSender(async (t, payload) => { …; return { status: 'sent', providerId: '' } })`.
 * Return `{ status: 'gone' }` for a 404/410 so the dead device is forgotten.
 */
export function setPushSender(push: Senders['push']) {
  pushSender = push;
}

/** Tests: replace the senders (pass null to restore the real ones). */
export function setSendersForTests(s: Senders | null) {
  override = s;
}
