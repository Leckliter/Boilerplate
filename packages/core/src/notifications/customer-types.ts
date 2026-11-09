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

/** The double opt-in email: nobody is on the newsletter until they click it. */
export const newsletterConfirm = defineType<{ confirmUrl: string }>()({
  key: 'newsletter.confirm',
  audience: 'customer',
  label: 'Newsletter confirmation',
  description: 'The email asking you to confirm that you want our newsletter.',
  required: true,
  hidden: true,
  defaults: { email: true, sms: false, push: false },
  render: (d) => ({
    title: 'Confirm your subscription',
    body: `Please confirm that you want the ${appName()} newsletter. If you didn’t ask for it, ignore this email and nothing will happen.`,
    emailSubject: `Confirm your subscription to ${appName()}`,
    url: d.confirmUrl,
    action: 'Yes, subscribe me',
    sms: `Confirm your ${appName()} newsletter subscription: ${d.confirmUrl}`,
  }),
});

/** Tells the person their data export finished. */
export const accountExportReady = defineType<{ filename: string }>()({
  key: 'account.exportReady',
  audience: 'customer',
  label: 'Your data export is ready',
  description: 'Sent when the copy of your data you asked for is ready to download.',
  required: true,
  hidden: true,
  defaults: { email: true, sms: false, push: true },
  render: (d, to) => ({
    title: 'Your data export is ready',
    body: `${hi(to)}the copy of your data you asked for (${d.filename}) is ready. Sign in to download it; the link stays available for 7 days.`,
    emailSubject: `Your ${appName()} data export is ready`,
    url: '/account/profile',
    action: 'Download my data',
    sms: 'Your data export is ready. Sign in to download it.',
  }),
});

/** Confirms a "delete my account" request and says how to take it back. */
export const accountDeletionScheduled = defineType<{ date: string; days: number }>()({
  key: 'account.deletionScheduled',
  audience: 'customer',
  label: 'Account deletion',
  description: 'Confirms that you asked to delete your account, and when it will happen.',
  required: true,
  hidden: true,
  defaults: { email: true, sms: false, push: true },
  render: (d, to) => ({
    title: 'Your account will be deleted',
    body: `${hi(to)}you asked us to delete your account. It will be erased on ${d.date} (in ${d.days} days). Changed your mind? Sign in before then and cancel the deletion.`,
    emailSubject: `Your ${appName()} account will be deleted on ${d.date}`,
    url: '/account/profile',
    action: 'Cancel the deletion',
    sms: `Your ${appName()} account will be deleted on ${d.date}. Sign in to cancel.`,
  }),
});
