/** THE list of notification types — add every new type here (see ./base.ts for how). */

import type { NotificationType } from './base';
import {
  accountDeletionScheduled,
  accountExportReady,
  accountMessage,
  newsletterConfirm,
  testMessage,
} from './customer-types';
import {
  staffAutomationFailed,
  staffAutomationMessage,
  staffErrorSpike,
  staffNewError,
  staffNewInquiry,
} from './staff-types';

export const NOTIFICATION_TYPES = [
  accountMessage,
  testMessage,
  newsletterConfirm,
  accountExportReady,
  accountDeletionScheduled,
  staffNewError,
  staffErrorSpike,
  staffAutomationMessage,
  staffAutomationFailed,
  staffNewInquiry,
] as const;

/** Type keys and the data each one needs — `notify` is checked against this. */
export type NotificationDataMap = {
  [T in (typeof NOTIFICATION_TYPES)[number] as T['key']]: Parameters<T['render']>[0];
};
export type NotificationKey = keyof NotificationDataMap;

const byKey = new Map<string, NotificationType<unknown>>(
  NOTIFICATION_TYPES.map((t) => [t.key, t as unknown as NotificationType<unknown>]),
);

export function getNotificationType(key: string): NotificationType<unknown> | undefined {
  return byKey.get(key);
}
