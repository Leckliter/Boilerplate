# Notifications

`notify(tx, 'type', { to, data, dedupeKey })` inside an action: the person gets an **inbox item**
(`app.notifications`) and one **delivery** per channel they should get (`app.notification_deliveries`):
email (Resend), SMS (Quo), push (Web Push, below). A dispatcher sends after the request and every minute.
Code: `packages/core/src/{notifications,messaging}`, actions `notifications.*`, UI `/account/notifications`
(inbox + settings) and `/admin/notifications` (delivery log, retry).

## Types

Every type is listed in `notifications/registry.ts` (customer ones in `customer-types.ts`, staff ones
in `staff-types.ts`): `key`, `audience` (`customer`: `to: contactId`; `staff`: `to: { permission }`
reaches everyone holding it), label and description (shown in settings), `defaults` per channel,
`required` (receipts, security: email cannot be turned off; never marketing), `urgent` (ignores quiet
hours), and `render(data, to)` giving title, body, email subject, SMS text and link. Skill: `add-notification`.

Built in: `account.message`, `system.test`, `newsletter.confirm`, `account.exportReady`, `account.deletionScheduled`,
`staff.newError`, `staff.errorSpike`, `staff.automationMessage`, `staff.automationFailed`, `staff.newInquiry`. A type with
`hidden: true` (one-off confirmations) is not listed in the person's settings. `registerErrorAlerts` sends the two error types to
everyone with `errors.manage`.

## What decides who gets what

1. The person's **preferences** (`notification_preferences`), else the type's defaults.
2. **SMS needs recorded consent**: `contacts.sms_consent_at` (+ the wording and source). No consent, no
   delivery row — it is never queued, and is re-checked at send time. `notifications.setSmsConsent`
   records it (yourself, or staff for someone who agreed on the phone). A `STOP` reply:
   `notifications.recordSuppression` (system, for the provider webhook) suppresses the number and clears consent.
3. **Suppressions** (`message_suppressions`): bounced/complained emails, STOP numbers.
4. **Quiet hours:** customer texts and pushes wait until 8am in `APP_TIME_ZONE` (staff alerts and `urgent` skip this).
5. **Test-recipient guard:** outside production, email and SMS go only to `TEST_RECIPIENTS_EMAIL` /
   `TEST_RECIPIENTS_SMS`; anything else is recorded as skipped, never sent.
6. Optional emails carry an unsubscribe link (`/api/v1/unsubscribe?t=…`, signed with `NOTIFICATIONS_SECRET`).

## Sending and retries

`notify` queues the `notifications.dispatch` job (right after the request) and the per-minute tick
sends anything due later. A failed send is retried after 1 min, 5 min, 30 min, 2 h, then marked
`failed` (Admin → Notifications → Retry). One email layout for everything: `messaging/email-layout.ts`.

## Cron

The cron route must call `runDueJobs()` and then `runModuleTicks()` (from `@app/core/modules`): that is
what sends delayed deliveries and starts scheduled automations.

## Push (Web Push)

Push deliveries go to every device a person subscribed (`app.push_subscriptions`) through the `web-push`
library (`notifications/push-sender.ts`), registered by the notifications module. Set `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (`npx web-push generate-vapid-keys`; the subject is a `mailto:` or
`https:` URL); without them a push is recorded as skipped ("not set up").

- **Browser side:** `GET /api/push/public-key` → `{ configured, publicKey }`; the page registers a service worker,
  calls `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` and sends the result to
  `push.subscribe` `{ endpoint, keys: { p256dh, auth }, label? }`. `push.unsubscribe { endpoint }` forgets a device;
  `push.status` says whether push is configured and lists the person's devices. The service worker shows
  `{ title, body, url, tag }` (the payload we send).
- **Answers of the push service:** 2xx = sent; **404 / 410 = the browser unsubscribed, so the subscription is
  deleted** (the dispatcher prunes it and records the delivery as skipped); anything else is retried like email.
- **Tests** inject a fake: `setSendersForTests({ email, sms, push })`, or `createWebPushSender(fakeSend, () => env)`
  to test the mapping. Nothing in the tests touches the network.

## Webhooks (Resend and Quo → us)

Both routes read the **raw body**, verify the signature **and a timestamp within 5 minutes** (replay protection),
then run a system action, so the work is logged and transactional. Without the secret a route answers `503`
(nothing is ever accepted unsigned); a bad signature is `401`; an unreadable body `400`; an unexpected failure is
reported with `reportError` and answered `500` so the provider retries. Redelivered events are harmless: updates
are idempotent and events are recorded once per provider event id (`emit(…, { dedupeKey })`).

| Route                       | Secret                                   | Signature                                                                                                                                                  | Does                                                                                                                                                                                                                                                                                           |
| --------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/webhooks/resend` | `RESEND_WEBHOOK_SECRET` (`whsec_…`)      | Svix: `svix-id`, `svix-timestamp`, `svix-signature` (`v1,<base64 HMAC-SHA256>` over `id.timestamp.body`)                                                   | `email.delivered` → delivery `delivered`; `email.bounced` → delivery `failed`, a **permanent** bounce suppresses the address; `email.complained` → suppressed; each emits `email.bounced`; `email.failed` → delivery `failed`                                                                  |
| `POST /api/webhooks/quo`    | `QUO_WEBHOOK_SECRET` (Quo's signing key) | `openphone-signature: hmac;1;<timestamp>;<base64 HMAC-SHA256 of "<timestamp>.<body>">`, or (no signature) the same secret in the `x-webhook-secret` header | `message.received` → event `sms.received`; **STOP** (also STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT) → number suppressed and SMS consent cleared; **START** / UNSTOP → suppression lifted and consent recorded again (source `sms-reply`); `message.delivered` → delivery `delivered` / `failed` |

Only a message that is exactly a keyword counts ("please stop" does not). The shared-secret fallback has no
timestamp, so it relies on the event-id dedupe alone — prefer the signed form. Add the webhooks in Resend
(events email.delivered, email.bounced, email.complained, email.failed) and Quo (message.received,
message.delivered). Code: `webhooks/verify.ts` (signatures), `actions/webhooks/` (handlers),
`apps/web/app/api/webhooks/` (routes), tests in `packages/core/test/webhooks.test.ts` and
`apps/web/test/api/webhooks.test.ts`.

## The bell

`notifications.recent { limit }` returns the newest inbox items with their `href` and the unread count (what the
bell menu shows); `notifications.markAllRead` clears the unread count. `notifications.list` is the full inbox
(views, paging); `notifications.unreadCount` is the cheap badge.

## Inquiries and the newsletter

- **Contact form:** `inquiries.create` (public; rate-limited to 5 per hour per IP, bot-checked when Turnstile is
  set up) stores an `app.inquiries` row, links the contact with that email (a new one is created and tagged `lead`;
  an existing customer or staff member is linked, never duplicated or re-tagged), emits `inquiry.created` and
  notifies everyone with `inquiries.manage` (`staff.newInquiry`). A hidden `website` field is a **honeypot**: bots
  fill it, real people never see it; anything in it is dropped silently. Staff work through them with
  `inquiries.list | get | update { status, note } | archive` (statuses new, in_progress, resolved, spam, archived).
- **Newsletter (double opt-in):** `newsletter.subscribe` records a _pending_ subscription (with the exact wording
  shown) and sends the `newsletter.confirm` email; the link (`/api/v1/newsletter/confirm?t=…`, valid 7 days, GET
  shows a button, POST confirms so mail scanners cannot subscribe anyone) calls `newsletter.confirm`: subscribed,
  consent time + wording + source recorded, contact tagged `newsletter`, `newsletter.subscribed` emitted. The
  answer to `subscribe` never reveals whether an address is already on the list. `newsletter.unsubscribe` takes the
  signed token from a newsletter's footer (`newsletterUnsubscribeUrl(subscriptionId)` from `@app/core/newsletter`,
  also route `/api/v1/newsletter/unsubscribe`, which supports mail apps' one-click POST) or, signed in, nothing.
  Sending newsletters themselves is up to you (Resend broadcasts, an automation…).

## Account data (privacy)

- **`account.exportData`:** queues the job `account.exportData`; it gathers everything held about the person
  (`account.exportPayload`), stores one private JSON file (files purpose `data_export`, visible only to that person,
  removed after 7 days by the daily maintenance step), and notifies them (`account.exportReady`). The UI reads it
  with `files.list { purpose: 'data_export', subjectId: <their contact id> }`. Needs file storage.
- **`account.requestDeletion` / `cancelDeletion` / `deletionStatus`:** a pending request waits out the grace period
  (setting **`account.deletionGraceDays`**, whole days 0–365, default **14**), then the daily maintenance step
  (`account.processDeletions`) **anonymises** the contact: name, email, phone, notes, login link, SMS consent, tags,
  roles, preferences, devices, inbox, newsletter rows and files are wiped (their bytes are removed by job), API keys
  revoked, inquiries blanked, `account.deleted` emitted (delete the login at your auth provider when you see it). The
  contact row stays, archived as "Deleted account", so history still points at something. The audit trail is kept
  but its personal fields (change-log before/after, activity inputs) are scrubbed — the one place an audit row is
  edited. Message suppressions (bounced / STOP addresses) are kept on purpose: they protect people from being mailed
  again. **The last owner cannot ask** (and a due request that would remove the last owner is held back with a note),
  and only the person themself on the website can ask — never an API key or an AI.
- **Changing your email** is not an action here: the address is the key the login is linked by, so it changes at the
  sign-in provider. The account screen should start the provider's change-email flow through the auth adapter
  (`apps/web/lib/auth/`, a confirmation mail to the new address); when the person has confirmed it and signs in
  again, `resolveSignedInContact` copies the new address onto their contact (`syncLoginEmail`, logged). There is no `account.updateEmailRequest` on purpose: it
  would be a second way to change who can log in.

## Environment

`RESEND_API_KEY`, `EMAIL_FROM`, `QUO_API_KEY`, `QUO_FROM_NUMBER`, `TEST_RECIPIENTS_EMAIL`,
`TEST_RECIPIENTS_SMS`, `NOTIFICATIONS_SECRET`, `APP_NAME` (shown in emails and texts), `RESEND_WEBHOOK_SECRET`,
`QUO_WEBHOOK_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

## Removing the module

Delete `notifications/`, `messaging/`, `actions/notifications`, `actions/push`, `actions/webhooks`, the
`modules.ts` line, the notification, webhook and push routes and nav rows (`inquiries/`, `newsletter/` and
`account-data/` are their own modules and call `notify`: remove them too, or keep notifications); automations' message steps (`steps.ts`) call `notify`, so remove them too (or the
automations module with it).
