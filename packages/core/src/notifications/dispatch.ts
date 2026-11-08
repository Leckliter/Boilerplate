import {
  and,
  contacts,
  eq,
  getDb,
  inArray,
  messageSuppressions,
  type NotificationDelivery,
  notificationDeliveries,
  notifications,
  pushSubscriptions,
  sql,
} from '@app/db';

import { getSiteUrl } from '../env';
import type { SendResult } from '../messaging';
import { getNotificationType } from './registry';
import { absoluteUrl, renderEmail } from '../messaging/email-layout';
import { smsText } from './consent';
import { senders } from './senders';
import { signUnsubscribe } from './tokens';

/** Wait this long before attempt 2, 3, 4, 5. After 5 attempts it's failed. */
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];
const MAX_ATTEMPTS = BACKOFF_MS.length + 1;
/** A delivery stuck in `sending` this long (the server died mid-send) is tried again. */
const STUCK_MS = 10 * 60_000;

export type DispatchResult = { sent: number; failed: number; skipped: number; retrying: number };

/**
 * Send every delivery that is due. Safe to run from many places at once (each
 * delivery is claimed with SKIP LOCKED, so it's sent once). Runs after every
 * request that changed data, and every minute from cron as the safety net.
 */
export async function dispatchDue(
  opts: { limit?: number; now?: Date } = {},
): Promise<DispatchResult> {
  const now = opts.now ?? new Date();
  const claimed = await claim(opts.limit ?? 50, now);
  const result: DispatchResult = { sent: 0, failed: 0, skipped: 0, retrying: 0 };
  for (const d of claimed) {
    const outcome = await deliver(d).catch((err: unknown): Outcome => ({
      kind: 'retry',
      error: String((err as Error)?.message ?? err),
    }));
    await settle(d, outcome, now);
    if (outcome.kind === 'sent') result.sent++;
    else if (outcome.kind === 'skipped') result.skipped++;
    else if (outcome.kind === 'failed' || d.attempts >= MAX_ATTEMPTS) result.failed++;
    else result.retrying++;
  }
  return result;
}

async function claim(limit: number, now: Date): Promise<NotificationDelivery[]> {
  const stuck = new Date(now.getTime() - STUCK_MS);
  const rows = await getDb().execute<{ id: string }>(sql`
    update app.notification_deliveries
    set status = 'sending', attempts = attempts + 1, updated_at = ${now.toISOString()}::timestamptz
    where id in (
      select id from app.notification_deliveries
      where (status = 'pending' and next_attempt_at <= ${now.toISOString()}::timestamptz)
         or (status = 'sending' and updated_at < ${stuck.toISOString()}::timestamptz)
      order by next_attempt_at
      limit ${limit}
      for update skip locked
    )
    returning id`);
  const ids = [...rows].map((r) => r.id);
  if (!ids.length) return [];
  return getDb()
    .select()
    .from(notificationDeliveries)
    .where(inArray(notificationDeliveries.id, ids));
}

type Outcome =
  | { kind: 'sent'; providerId?: string }
  | { kind: 'skipped'; reason: string }
  | { kind: 'retry'; error: string }
  | { kind: 'failed'; error: string };

async function deliver(d: NotificationDelivery): Promise<Outcome> {
  const db = getDb();
  const [n] = await db
    .select({ notification: notifications, contact: contacts })
    .from(notifications)
    .innerJoin(contacts, eq(contacts.id, notifications.contactId))
    .where(eq(notifications.id, d.notificationId));
  if (!n) return { kind: 'skipped', reason: 'Notification no longer exists' };
  const { notification, contact } = n;
  const content = notification.content;
  const type = getNotificationType(notification.type);
  const siteUrl = getSiteUrl();

  if (d.channel === 'email') {
    // Re-check at send time: a bounce or complaint may have arrived since.
    if (await isSuppressed('email', d.to)) return { kind: 'skipped', reason: 'Email suppressed' };
    const preferencesUrl = `${siteUrl}/account/notifications`;
    let unsubscribeUrl: string | undefined;
    if (!type?.required) {
      // Optional emails must carry a working unsubscribe link, or not go out at all.
      try {
        unsubscribeUrl = `${siteUrl}/api/v1/unsubscribe?t=${signUnsubscribe(contact.id, notification.type)}`;
      } catch {
        // Expected when NOTIFICATIONS_SECRET is missing; recorded as a skipped delivery.
        return {
          kind: 'skipped',
          reason: 'NOTIFICATIONS_SECRET isn’t set, so no unsubscribe link',
        };
      }
    }
    const { html, text } = renderEmail(content, { siteUrl, preferencesUrl, unsubscribeUrl });
    const res = await senders().email({
      to: d.to,
      subject: content.emailSubject,
      html,
      text,
      // Mail apps' one-click unsubscribe POSTs here (RFC 8058); the link in the email opens a page.
      headers: unsubscribeUrl
        ? {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          }
        : undefined,
    });
    return fromSendResult(res);
  }

  if (d.channel === 'sms') {
    // Consent can be withdrawn (STOP) or the number changed after this was queued.
    if (!contact.smsConsentAt || contact.phone !== d.to) {
      return { kind: 'skipped', reason: 'No SMS consent for this number any more' };
    }
    if (await isSuppressed('sms', d.to)) return { kind: 'skipped', reason: 'Replied STOP' };
    const res = await senders().sms({
      to: d.to,
      content: smsText(content.sms),
    });
    return fromSendResult(res);
  }

  // push
  const [sub] = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.id, d.to));
  if (!sub) return { kind: 'skipped', reason: 'Device no longer subscribed' };
  const res = await senders().push(
    sub,
    JSON.stringify({
      title: content.title,
      body: content.body,
      url: content.url ? absoluteUrl(content.url, siteUrl) : `${siteUrl}/account/notifications`,
      tag: notification.id,
    }),
  );
  if (res.status === 'gone') {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
    return { kind: 'skipped', reason: 'Device unsubscribed (removed)' };
  }
  if (res.status === 'sent') {
    await db
      .update(pushSubscriptions)
      .set({ lastSuccessAt: new Date() })
      .where(eq(pushSubscriptions.id, sub.id));
  }
  return fromSendResult(res);
}

function fromSendResult(res: SendResult): Outcome {
  switch (res.status) {
    case 'sent':
      return { kind: 'sent', providerId: res.providerId || undefined };
    case 'blocked':
      return { kind: 'skipped', reason: res.reason };
    case 'not_configured':
      return { kind: 'skipped', reason: 'This channel isn’t set up in this environment yet' };
    case 'failed':
      return { kind: 'retry', error: res.error };
  }
}

async function settle(d: NotificationDelivery, o: Outcome, now: Date) {
  const set =
    o.kind === 'sent'
      ? { status: 'sent' as const, sentAt: now, providerId: o.providerId ?? null, lastError: null }
      : o.kind === 'skipped'
        ? { status: 'skipped' as const, lastError: o.reason }
        : o.kind === 'failed' || d.attempts >= MAX_ATTEMPTS
          ? { status: 'failed' as const, lastError: o.error }
          : {
              status: 'pending' as const,
              lastError: o.error,
              nextAttemptAt: new Date(now.getTime() + BACKOFF_MS[d.attempts - 1]!),
            };
  await getDb()
    .update(notificationDeliveries)
    .set(set)
    .where(and(eq(notificationDeliveries.id, d.id), eq(notificationDeliveries.status, 'sending')));
}

async function isSuppressed(channel: 'email' | 'sms', address: string) {
  const [row] = await getDb()
    .select({ id: messageSuppressions.id })
    .from(messageSuppressions)
    .where(
      and(
        eq(messageSuppressions.channel, channel),
        eq(messageSuppressions.address, address.toLowerCase()),
      ),
    );
  return Boolean(row);
}
