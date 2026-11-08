import {
  and,
  contactRoles,
  contacts,
  eq,
  inArray,
  messageSuppressions,
  notificationDeliveries,
  notificationPreferences,
  notifications,
  pushSubscriptions,
  sql,
  type Tx,
} from '@app/db';

import { type Permission, ROLE_PERMISSIONS } from '../access';
import { enqueue } from '../jobs/enqueue';
import type { Channel, NotificationType } from './base';
import { nextAllowedTime } from './quiet-hours';
import { getNotificationType, type NotificationDataMap, type NotificationKey } from './registry';

type Contact = typeof contacts.$inferSelect;

export type NotifyOptions<K extends NotificationKey> = {
  /** A contact id, or everyone holding a permission (staff types). */
  to: string | { permission: Permission };
  data: NotificationDataMap[K];
  /** What it is about (for links and history). */
  subject?: { type: string; id: string };
  /** Never notify the same recipient twice with this key (e.g. the record id + day). */
  dedupeKey?: string;
  /**
   * Only these channels (e.g. ['sms'] for "text them"). Narrows, never widens: the person's
   * preferences, SMS consent, opt-outs and quiet hours still decide. The in-app inbox item is
   * always created.
   */
  channels?: readonly Channel[];
  now?: Date;
};

/**
 * Notify someone. Call it INSIDE the action's transaction: the notification exists only if the
 * action's changes are saved. It records the in-app item and queues one delivery per channel the
 * person gets (their preferences, the type's defaults, SMS consent, opt-outs, quiet hours).
 * Sending happens right after the request (job `notifications.dispatch`) and every minute from
 * cron — see dispatch.ts.
 *
 * Returns how many people were notified.
 */
export async function notify<K extends NotificationKey>(
  tx: Tx,
  key: K,
  opts: NotifyOptions<K>,
): Promise<number> {
  const type = getNotificationType(key);
  if (!type) throw new Error(`Unknown notification type "${key}"`);
  const recipients =
    typeof opts.to === 'string'
      ? await contactsById(tx, [opts.to])
      : await staffWith(tx, opts.to.permission);
  const now = opts.now ?? new Date();
  let count = 0;
  let queued = false;
  for (const contact of recipients) {
    const content = type.render(opts.data as never, {
      firstName: contact.firstName,
      displayName: contact.displayName,
    });
    const [created] = await tx
      .insert(notifications)
      .values({
        contactId: contact.id,
        type: key,
        content,
        subjectType: opts.subject?.type ?? null,
        subjectId: opts.subject?.id ?? null,
        dedupeKey: opts.dedupeKey ?? null,
        activityId: sql`nullif(current_setting('app.activity_id', true), '')::uuid`,
        createdAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: notifications.id });
    if (!created) continue; // already notified (dedupeKey)
    count++;
    const planned = await planDeliveries(tx, type, contact, now);
    const plan = opts.channels
      ? planned.filter((d) => opts.channels!.includes(d.channel))
      : planned;
    if (plan.length) {
      await tx
        .insert(notificationDeliveries)
        .values(plan.map((d) => ({ ...d, notificationId: created.id })));
      queued = true;
    }
  }
  // Send right after the request; cron picks up anything with a later time.
  if (queued) await enqueue(tx, 'notifications.dispatch', {}, { dedupeKey: 'now' });
  return count;
}

type PlannedDelivery = {
  channel: Channel;
  to: string;
  status: 'pending' | 'skipped';
  lastError?: string;
  nextAttemptAt: Date;
};

/** Which channels this person gets for this type, and when. */
async function planDeliveries(
  tx: Tx,
  type: NotificationType<unknown>,
  contact: Contact,
  now: Date,
): Promise<PlannedDelivery[]> {
  const prefs = await tx
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.contactId, contact.id),
        eq(notificationPreferences.type, type.key),
      ),
    );
  const wants = (channel: Channel) =>
    (channel === 'email' && type.required) ||
    (prefs.find((p) => p.channel === channel)?.enabled ?? type.defaults[channel]);
  const later = type.urgent ? now : nextAllowedTime(now);
  const plan: PlannedDelivery[] = [];

  if (wants('email') && contact.email) {
    const blocked = await suppressed(tx, 'email', contact.email);
    plan.push({
      channel: 'email',
      to: contact.email,
      status: blocked ? 'skipped' : 'pending',
      lastError: blocked ? `Email suppressed (${blocked})` : undefined,
      nextAttemptAt: now,
    });
  }

  // Texts need a phone AND recorded consent. No consent = no row (never text anyone without it).
  if (wants('sms') && contact.phone && contact.smsConsentAt) {
    const blocked = await suppressed(tx, 'sms', contact.phone);
    plan.push({
      channel: 'sms',
      to: contact.phone,
      status: blocked ? 'skipped' : 'pending',
      lastError: blocked ? `Texts turned off (${blocked})` : undefined,
      nextAttemptAt: type.audience === 'staff' && !type.urgent ? now : later,
    });
  }

  if (wants('push')) {
    const subs = await tx
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.contactId, contact.id));
    for (const s of subs) {
      plan.push({
        channel: 'push',
        to: s.id,
        status: 'pending',
        nextAttemptAt: type.audience === 'staff' ? now : later,
      });
    }
  }
  return plan;
}

async function suppressed(tx: Tx, channel: Channel, address: string): Promise<string | null> {
  const [row] = await tx
    .select({ reason: messageSuppressions.reason })
    .from(messageSuppressions)
    .where(
      and(
        eq(messageSuppressions.channel, channel),
        eq(messageSuppressions.address, address.toLowerCase()),
      ),
    );
  return row?.reason ?? null;
}

async function contactsById(tx: Tx, ids: string[]) {
  return tx
    .select()
    .from(contacts)
    .where(and(inArray(contacts.id, ids), eq(contacts.status, 'active')));
}

/** Everyone (not archived) whose roles grant this permission. */
async function staffWith(tx: Tx, permission: Permission): Promise<Contact[]> {
  const roles = Object.entries(ROLE_PERMISSIONS)
    .filter(([, perms]) => perms.includes(permission))
    .map(([role]) => role as keyof typeof ROLE_PERMISSIONS);
  if (!roles.length) return [];
  const rows = await tx
    .selectDistinctOn([contacts.id], { contact: contacts })
    .from(contacts)
    .innerJoin(contactRoles, eq(contactRoles.contactId, contacts.id))
    .where(and(inArray(contactRoles.role, roles), eq(contacts.status, 'active')));
  return rows.map((r) => r.contact);
}
