import type { NotificationContent } from '@app/db';

import type { Permission } from '../access';

/**
 * The shape of a notification type. Each says who gets it, which channels are on by default, and
 * what it says on every channel. Write a new one in ./customer-types.ts or ./staff-types.ts, list
 * it in ./registry.ts, then call `notify(tx, 'type.key', …)` from the action where it happens.
 *
 * - audience `customer`: sent to the contact it is about (`to: contactId`).
 * - audience `staff`: sent to everyone whose roles grant `permission` (`to: { permission }`).
 * - `required`: transactional (receipts, cancellations, security). Email can't be turned off;
 *   other channels can. Never use it for marketing.
 * - `urgent`: ignores quiet hours (texts to customers otherwise wait until the morning).
 *
 * Everyone always gets the in-app inbox item; `defaults` are for email, SMS and push. SMS also
 * needs the person's recorded consent (docs/notifications.md).
 */
export type Channel = 'email' | 'sms' | 'push';
export const CHANNELS: readonly Channel[] = ['email', 'sms', 'push'];

export type Recipient = { firstName: string | null; displayName: string };

export type NotificationType<D = never, K extends string = string> = {
  key: K;
  audience: 'customer' | 'staff';
  /** Shown in preferences. */
  label: string;
  /** Shown in preferences: when it is sent. */
  description: string;
  /** Staff: who receives it (and may configure it). */
  permission?: Permission;
  required?: boolean;
  urgent?: boolean;
  /** Not listed in the person's notification settings (one-off confirmations). */
  hidden?: boolean;
  defaults: Record<Channel, boolean>;
  render: (data: D, to: Recipient) => NotificationContent;
};

export const CUSTOMER_DEFAULTS = { email: true, sms: true, push: true };
export const STAFF_DEFAULTS = { email: true, sms: false, push: true };

/** `defineType<DataShape>()({ key: 'area.event', … })` — keeps the key as a literal type. */
export const defineType =
  <D>() =>
  <K extends string>(t: NotificationType<D, K>) =>
    t;

/** "Hi Pat, " — or nothing when we don't know the first name. */
export const hi = (to: Recipient) => (to.firstName ? `Hi ${to.firstName}, ` : '');

/** What an automation's message steps (and `account.message`) carry. */
export type MessageData = {
  title: string;
  body: string;
  sms?: string;
  url?: string;
  automationName?: string;
};
