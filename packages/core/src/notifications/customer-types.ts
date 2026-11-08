/** Notification types sent to customers (audience `customer`). Listed in ./registry.ts. */
import { appName } from '../messaging/email-layout';
import { CUSTOMER_DEFAULTS, defineType, hi, type MessageData } from './base';

/** A message an automation (or your own code) sends to one contact. */
export const accountMessage = defineType<MessageData>()({
  key: 'account.message',
  audience: 'customer',
  label: 'Updates and reminders',
  description: 'Follow-ups and reminders from us.',
  defaults: CUSTOMER_DEFAULTS,
  render: (d, to) => ({
    title: d.title,
    body: `${hi(to)}${d.body}`,
    emailSubject: d.title,
    url: d.url ?? '/account',
    action: d.url ? 'Open' : 'Your account',
    sms: d.sms ?? d.body,
  }),
});

/** "Send me a test" in notification settings. */
export const testMessage = defineType<{ channel: string }>()({
  key: 'system.test',
  audience: 'customer',
  label: 'Test messages',
  description: 'Sent when you press “Send me a test”.',
  urgent: true,
  defaults: { email: true, sms: true, push: true },
  render: (d, to) => ({
    title: 'Test notification',
    body: `${hi(to)}this is a test ${d.channel} from ${appName()}. If you can read it, it works.`,
    emailSubject: `Test notification from ${appName()}`,
    url: '/account/notifications',
    action: 'Notification settings',
    sms: `Test text from ${appName()}: it works.`,
  }),
});
