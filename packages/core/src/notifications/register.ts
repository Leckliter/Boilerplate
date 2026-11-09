/**
 * Switches the notifications module on (imported from packages/core/src/modules.ts): registers its
 * actions, the `notifications.dispatch` job, the per-minute tick, and the staff alerts for new
 * errors and spikes. Delete this folder, the action folder, the line in modules.ts and the
 * notification routes to remove the module (docs/notifications.md).
 */
import { z } from 'zod';

import { registerActions } from '../actions/registry-store';
import {
  dismissNotifications,
  getPreferences,
  listDeliveries,
  listNotifications,
  markAllRead,
  markRead,
  openNotification,
  recentNotifications,
  recordSuppression,
  retryDelivery,
  sendTest,
  setPreference,
  setSmsConsent,
  unreadCount,
  unsubscribe,
} from '../actions/notifications';
import { pushStatus, subscribePush, unsubscribePush } from '../actions/push';
import { quoWebhook, resendWebhook } from '../actions/webhooks';
import { registerErrorAlerts } from '../errors/alerts';
import { defineJob, registerJob } from '../jobs';
import { registerTick } from '../module-ticks';
import { dispatchDue } from './dispatch';
import { notify } from './notify';
import { webPushSender } from './push-sender';
import { setPushSender } from './senders';

registerActions(
  listNotifications,
  recentNotifications,
  unreadCount,
  markRead,
  markAllRead,
  dismissNotifications,
  openNotification,
  getPreferences,
  setPreference,
  setSmsConsent,
  unsubscribe,
  sendTest,
  listDeliveries,
  retryDelivery,
  recordSuppression,
  // web push + provider webhooks
  subscribePush,
  unsubscribePush,
  pushStatus,
  resendWebhook,
  quoWebhook,
);

// Real Web Push (VAPID keys from the environment; "not set up" without them).
setPushSender(webPushSender);

/** Send everything that is due, repeating while there is work (a batch is 50). */
async function sendDue(now = new Date()) {
  const total = { sent: 0, failed: 0, skipped: 0, retrying: 0 };
  for (let i = 0; i < 20; i++) {
    const r = await dispatchDue({ now });
    total.sent += r.sent;
    total.failed += r.failed;
    total.skipped += r.skipped;
    total.retrying += r.retrying;
    if (r.sent + r.failed + r.skipped + r.retrying === 0) break;
  }
  return total;
}

registerJob(
  defineJob({
    type: 'notifications.dispatch',
    description:
      'Send the emails, texts and pushes that are due. Queued by notify() so messages go out right after the request.',
    payload: z.object({}),
    maxAttempts: 5,
    run: () => sendDue(),
  }),
);

// Deliveries waiting for quiet hours to end, or for a retry delay, are sent by the cron route.
registerTick('notifications.dispatch', (now) => sendDue(now));

registerErrorAlerts(async (tx, alert) => {
  const common = {
    ref: alert.ref,
    code: alert.code,
    message: alert.message,
    where: alert.where,
    environment: alert.environment,
  };
  if (alert.kind === 'new') {
    await notify(tx, 'staff.newError', {
      to: { permission: 'errors.manage' },
      data: common,
      dedupeKey: alert.dedupeKey,
    });
  } else {
    await notify(tx, 'staff.errorSpike', {
      to: { permission: 'errors.manage' },
      data: { ...common, count: alert.count ?? 0, minutes: alert.minutes ?? 0 },
      dedupeKey: alert.dedupeKey,
    });
  }
});
