import { getAppEnv } from '../env';
import { isRecipientAllowed } from './guard';

export { isRecipientAllowed } from './guard';
export { appName, renderEmail, absoluteUrl, type EmailContent } from './email-layout';

/**
 * Low-level sending. Only `packages/core/src/notifications` calls these (rule 8: everything else
 * uses `notify(tx, …)` so preferences, SMS consent, retries and the delivery log apply).
 * Every send goes through the test-recipient guard, so outside production nothing reaches a real
 * person who is not listed in TEST_RECIPIENTS_*.
 */
export type SendResult =
  | { status: 'sent'; providerId: string }
  | { status: 'blocked'; reason: string }
  | { status: 'not_configured' }
  | { status: 'failed'; error: string };

/** Send an email through Resend (RESEND_API_KEY, EMAIL_FROM). */
export async function sendEmail(msg: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Extra headers, e.g. List-Unsubscribe. */
  headers?: Record<string, string>;
}): Promise<SendResult> {
  if (!isRecipientAllowed('email', msg.to)) {
    console.warn(`[email] blocked in ${getAppEnv()}: ${msg.to} is not in TEST_RECIPIENTS_EMAIL`);
    return { status: 'blocked', reason: `Not a test recipient (${getAppEnv()})` };
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { status: 'not_configured' };
  const subject = getAppEnv() === 'production' ? msg.subject : `[TEST] ${msg.subject}`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [msg.to],
      subject,
      html: msg.html,
      text: msg.text,
      reply_to: msg.replyTo,
      headers: msg.headers,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  // A non-JSON reply still has an HTTP status, which is reported below.
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  return res.ok && body.id
    ? { status: 'sent', providerId: body.id }
    : { status: 'failed', error: body.message ?? `HTTP ${res.status}` };
}

/** Send a text through Quo's REST API (QUO_API_KEY, QUO_FROM_NUMBER in E.164). */
export async function sendSms(msg: {
  to: string;
  content: string;
  /** Send from this Quo number instead of QUO_FROM_NUMBER. */
  from?: string;
}): Promise<SendResult> {
  if (!isRecipientAllowed('sms', msg.to)) {
    console.warn(`[sms] blocked in ${getAppEnv()}: ${msg.to} is not in TEST_RECIPIENTS_SMS`);
    return { status: 'blocked', reason: `Not a test recipient (${getAppEnv()})` };
  }
  const apiKey = process.env.QUO_API_KEY;
  const from = msg.from ?? process.env.QUO_FROM_NUMBER;
  if (!apiKey || !from) return { status: 'not_configured' };
  const content = getAppEnv() === 'production' ? msg.content : `[TEST] ${msg.content}`;
  const base = process.env.QUO_API_BASE ?? 'https://api.openphone.com/v1';
  const res = await fetch(`${base}/messages`, {
    method: 'POST',
    // Quo takes the key as is (no "Bearer").
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, from, to: [msg.to] }),
    signal: AbortSignal.timeout(15_000),
  });
  // A non-JSON reply still has an HTTP status, which is reported below.
  const body = (await res.json().catch(() => ({}))) as {
    data?: { id?: string };
    message?: string;
    errors?: { message?: string }[];
  };
  return res.ok && body.data?.id
    ? { status: 'sent', providerId: body.data.id }
    : {
        status: 'failed',
        error: body.errors?.[0]?.message ?? body.message ?? `HTTP ${res.status}`,
      };
}
