import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { contacts } from './contacts';
import { app, createdAt, id, updatedAt } from './_shared';

/**
 * Notifications. See docs/notifications.md.
 *
 * notification — one message to one person ("Your report is ready").
 *                It IS the in-app inbox item; its content is rendered when created.
 * delivery     — one attempt-tracked send of that notification over email, SMS
 *                or push: pending → sending → sent (→ delivered) / failed / skipped.
 */

/** Channels a notification can be SENT on. (The in-app inbox always gets it.) */
export const notificationChannel = app.enum('notification_channel', ['email', 'sms', 'push']);

export const deliveryStatus = app.enum('delivery_status', [
  'pending', // waiting for its time (now, or after quiet hours / a retry delay)
  'sending', // claimed by a dispatcher
  'sent', // the provider accepted it
  'delivered', // the provider confirmed delivery (email)
  'failed', // gave up (after retries, or a permanent error such as a bounce)
  'skipped', // never sent, on purpose (no consent, opted out, test environment …)
]);

/** What a notification says, rendered once when it's created. */
export type NotificationContent = {
  title: string;
  body: string;
  /** Path or URL to open, e.g. /account/reports/… */
  url?: string;
  /** Button label for the link, e.g. "View report". */
  action?: string;
  emailSubject: string;
  /** Extra paragraphs for the email (the body is always first). */
  emailLines?: string[];
  sms: string;
  /** The language the text above is written in (e.g. 'es'); missing means the app's default. */
  lang?: string;
};

export const notifications = app
  .table(
    'notifications',
    {
      id: id(),
      /** The recipient. */
      contactId: uuid('contact_id')
        .notNull()
        .references(() => contacts.id, { onDelete: 'cascade' }),
      /** The notification type key, e.g. `report.ready` (packages/core/src/notifications/catalog.ts). */
      type: text('type').notNull(),
      content: jsonb('content').$type<NotificationContent>().notNull(),
      /** What it's about, e.g. report + id — for links and history. */
      subjectType: text('subject_type'),
      subjectId: uuid('subject_id'),
      /** Same type + recipient + key is never notified twice (webhook retries, cron reruns). */
      dedupeKey: text('dedupe_key'),
      /** The activity-log entry of the action that caused it, when there was one. */
      activityId: uuid('activity_id'),
      createdAt: createdAt(),
      readAt: timestamp('read_at', { withTimezone: true }),
      /** Dismissed from the bell ("Clear"). Kept for the history; never shown again. */
      archivedAt: timestamp('archived_at', { withTimezone: true }),
    },
    (t) => [
      index('notifications_contact_idx').on(t.contactId, t.createdAt),
      uniqueIndex('notifications_dedupe_key')
        .on(t.contactId, t.type, t.dedupeKey)
        .where(sql`${t.dedupeKey} is not null`),
    ],
  )
  .enableRLS();

export const notificationDeliveries = app
  .table(
    'notification_deliveries',
    {
      id: id(),
      notificationId: uuid('notification_id')
        .notNull()
        .references(() => notifications.id, { onDelete: 'cascade' }),
      channel: notificationChannel('channel').notNull(),
      status: deliveryStatus('status').notNull().default('pending'),
      /** Email address, phone number, or push subscription id. */
      to: text('to').notNull(),
      /** Not before this time (quiet hours, retry backoff). */
      nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
      attempts: integer('attempts').notNull().default(0),
      /** Why it failed or was skipped. */
      lastError: text('last_error'),
      /** The provider's message id (Resend email id, Quo message id). */
      providerId: text('provider_id'),
      sentAt: timestamp('sent_at', { withTimezone: true }),
      deliveredAt: timestamp('delivered_at', { withTimezone: true }),
      createdAt: createdAt(),
      updatedAt: updatedAt(),
    },
    (t) => [
      index('notification_deliveries_due_idx').on(t.status, t.nextAttemptAt),
      index('notification_deliveries_notification_idx').on(t.notificationId),
      index('notification_deliveries_provider_idx').on(t.providerId),
    ],
  )
  .enableRLS();

/** A person's choice for one type on one channel. No row = the type's default. */
export const notificationPreferences = app
  .table(
    'notification_preferences',
    {
      contactId: uuid('contact_id')
        .notNull()
        .references(() => contacts.id, { onDelete: 'cascade' }),
      type: text('type').notNull(),
      channel: notificationChannel('channel').notNull(),
      enabled: boolean('enabled').notNull(),
      updatedAt: updatedAt(),
    },
    (t) => [primaryKey({ columns: [t.contactId, t.type, t.channel] })],
  )
  .enableRLS();

/** A browser / installed app that accepts Web Push for a person. */
export const pushSubscriptions = app
  .table(
    'push_subscriptions',
    {
      id: id(),
      contactId: uuid('contact_id')
        .notNull()
        .references(() => contacts.id, { onDelete: 'cascade' }),
      endpoint: text('endpoint').notNull().unique(),
      p256dh: text('p256dh').notNull(),
      auth: text('auth').notNull(),
      /** e.g. "Chrome on Android" — shown in settings. */
      label: text('label'),
      createdAt: createdAt(),
      lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    },
    (t) => [index('push_subscriptions_contact_idx').on(t.contactId)],
  )
  .enableRLS();

/**
 * Addresses we must not send to: an email that hard-bounced or was marked as
 * spam, or a phone that replied STOP. Keyed by address (not contact), so it
 * holds even if the address moves to another contact.
 */
export const messageSuppressions = app
  .table(
    'message_suppressions',
    {
      id: id(),
      channel: notificationChannel('channel').notNull(),
      /** Lower-cased email or E.164 phone. */
      address: text('address').notNull(),
      /** bounce, complaint, stop, manual */
      reason: text('reason').notNull(),
      detail: text('detail'),
      createdAt: createdAt(),
    },
    (t) => [uniqueIndex('message_suppressions_address_key').on(t.channel, t.address)],
  )
  .enableRLS();

export type Notification = typeof notifications.$inferSelect;
export type NotificationDelivery = typeof notificationDeliveries.$inferSelect;
