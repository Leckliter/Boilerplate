// ---------------------------------------------------------------- admin
/** The delivery log for staff: test sends, listing and retrying deliveries, suppressions. */

import {
  and,
  contacts,
  desc,
  eq,
  inArray,
  lt,
  notificationDeliveries,
  notifications,
} from '@app/db';
import { z } from 'zod';

import { enqueue } from '../../jobs/enqueue';
import { notify } from '../../notifications/notify';
import { suppressAddress } from '../../notifications/suppress';
import { ActionError, defineAction } from '../define';
import { instantField } from '../fields';
import { channelField, me } from './shared';

export const sendTest = defineAction({
  name: 'notifications.sendTest',
  title: 'Send me a test notification',
  description:
    'Send the signed-in person a test notification on every channel they can receive (or just one), to check ' +
    'their settings work. Ignores quiet hours. Texts only go out with recorded consent.',
  audience: 'authenticated',
  mutates: true,
  returns: '{ channels: string[] } (what was queued: inbox always, then email / sms / push)',
  input: z.object({ channel: channelField.optional() }),
  async run({ input, actor, tx, log }) {
    const contactId = me(actor);
    const dedupeKey = `test:${crypto.randomUUID()}`;
    await notify(tx, 'system.test', {
      to: contactId,
      data: { channel: input.channel ?? 'notification' },
      dedupeKey,
      channels: input.channel ? [input.channel] : undefined,
    });
    const queued = await tx
      .select({ channel: notificationDeliveries.channel, status: notificationDeliveries.status })
      .from(notificationDeliveries)
      .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
      .where(and(eq(notifications.contactId, contactId), eq(notifications.dedupeKey, dedupeKey)));
    const channels = ['inbox', ...new Set(queued.map((d) => d.channel))];
    log({
      subjectType: 'contact',
      subjectId: contactId,
      summary: `Sent a test notification (${channels.join(', ')})`,
    });
    return { channels };
  },
});

export const listDeliveries = defineAction({
  name: 'notifications.deliveries',
  title: 'Notification delivery log',
  description:
    'Every email, text and push sent (or not) to anyone, newest first: to whom, which type, the status ' +
    '(pending, sent, delivered, failed, skipped) and why it failed or was skipped. Filter by contact to see what ' +
    'one person was sent.',
  audience: 'notifications.manage',
  mutates: false,
  returns:
    '[{ id, channel, status, to, attempts, lastError, sentAt, deliveredAt, nextAttemptAt, type, title, contactId, contactName, createdAt }]',
  input: z.object({
    contactId: z.uuid().optional(),
    status: z.enum(['pending', 'sending', 'sent', 'delivered', 'failed', 'skipped']).optional(),
    channel: channelField.optional(),
    type: z.string().optional(),
    before: instantField.optional(),
    limit: z.number().int().min(1).max(200).default(100),
  }),
  async run({ input, tx }) {
    const rows = await tx
      .select({
        delivery: notificationDeliveries,
        type: notifications.type,
        content: notifications.content,
        contactId: notifications.contactId,
        contactName: contacts.displayName,
      })
      .from(notificationDeliveries)
      .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
      .innerJoin(contacts, eq(contacts.id, notifications.contactId))
      .where(
        and(
          input.contactId ? eq(notifications.contactId, input.contactId) : undefined,
          input.status ? eq(notificationDeliveries.status, input.status) : undefined,
          input.channel ? eq(notificationDeliveries.channel, input.channel) : undefined,
          input.type ? eq(notifications.type, input.type) : undefined,
          input.before ? lt(notificationDeliveries.createdAt, input.before) : undefined,
        ),
      )
      .orderBy(desc(notificationDeliveries.createdAt))
      .limit(input.limit);
    return rows.map((r) => ({
      id: r.delivery.id,
      channel: r.delivery.channel,
      status: r.delivery.status,
      // Push "to" is a device id; show the kind of target instead.
      to: r.delivery.channel === 'push' ? 'device' : r.delivery.to,
      attempts: r.delivery.attempts,
      lastError: r.delivery.lastError,
      sentAt: r.delivery.sentAt,
      deliveredAt: r.delivery.deliveredAt,
      nextAttemptAt: r.delivery.nextAttemptAt,
      createdAt: r.delivery.createdAt,
      type: r.type,
      title: r.content.title,
      contactId: r.contactId,
      contactName: r.contactName,
    }));
  },
});

export const retryDelivery = defineAction({
  name: 'notifications.retry',
  title: 'Retry a notification',
  description:
    'Send a failed or skipped email / text / push again now (e.g. after fixing a setting). It gets a fresh set of ' +
    'retries. A text is still only sent if the person’s consent is on record.',
  audience: 'notifications.manage',
  mutates: true,
  returns: '{ id, status }',
  input: z.object({ id: z.uuid() }),
  async run({ input, tx, log }) {
    const [d] = await tx
      .update(notificationDeliveries)
      .set({ status: 'pending', attempts: 0, nextAttemptAt: new Date(), lastError: null })
      .where(
        and(
          eq(notificationDeliveries.id, input.id),
          inArray(notificationDeliveries.status, ['failed', 'skipped']),
        ),
      )
      .returning();
    if (!d) throw new ActionError('conflict', 'Only failed or skipped deliveries can be retried.');
    const [n] = await tx
      .select({ contactId: notifications.contactId, content: notifications.content })
      .from(notifications)
      .where(eq(notifications.id, d.notificationId));
    // Send it now rather than at the next cron minute.
    await enqueue(tx, 'notifications.dispatch', {}, { dedupeKey: 'now' });
    log({
      subjectType: 'contact',
      subjectId: n?.contactId,
      summary: `Retrying ${d.channel} “${n?.content.title ?? ''}”`,
    });
    return { id: d.id, status: d.status };
  },
});

export const recordSuppression = defineAction({
  name: 'notifications.recordSuppression',
  title: 'Stop messaging an address',
  description:
    'System only: record that an email address or phone number must not be messaged (hard bounce, spam complaint, ' +
    'a reply of STOP). Called by the provider webhooks. A STOP also withdraws that phone’s recorded SMS consent.',
  audience: 'system',
  mutates: true,
  returns: '{ channel, address }',
  input: z.object({
    channel: z.enum(['email', 'sms']),
    address: z.string().trim().min(3).max(320),
    reason: z.enum(['bounce', 'complaint', 'stop', 'manual']),
    detail: z.string().max(500).optional(),
  }),
  async run({ input, tx, log }) {
    const address = await suppressAddress(tx, input);
    log({ summary: `Stopped ${input.channel} messages to ${address} (${input.reason})` });
    return { channel: input.channel, address };
  },
});
