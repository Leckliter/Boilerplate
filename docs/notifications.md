# Notifications

`notify(tx, 'type', { to, data, dedupeKey })` inside an action: the person gets an **inbox item**
(`app.notifications`) and one **delivery** per channel they should get (`app.notification_deliveries`):
email (Resend), SMS (Quo), push (a stub, below). A dispatcher sends after the request and every minute.
Code: `packages/core/src/{notifications,messaging}`, actions `notifications.*`, UI `/account/notifications`
(inbox + settings) and `/admin/notifications` (delivery log, retry).

## Types

Every type is listed in `notifications/registry.ts` (customer ones in `customer-types.ts`, staff ones
in `staff-types.ts`): `key`, `audience` (`customer`: `to: contactId`; `staff`: `to: { permission }`
reaches everyone holding it), label and description (shown in settings), `defaults` per channel,
`required` (receipts, security: email cannot be turned off; never marketing), `urgent` (ignores quiet
hours), and `render(data, to)` giving title, body, email subject, SMS text and link. Skill: `add-notification`.

Built in: `account.message`, `system.test`, `staff.newError`, `staff.errorSpike`,
`staff.automationMessage`, `staff.automationFailed`. `registerErrorAlerts` sends the two error types to
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

## Push (stub)

Push deliveries are planned for people with a row in `push_subscriptions` but report "not set up" until
you call `setPushSender(async (target, payload) => …)` once at startup (e.g. with the `web-push` package),
returning `{ status: 'sent', providerId }`, `{ status: 'failed', error }` or `{ status: 'gone' }`.
Adding the browser subscription UI and VAPID keys is up to you.

## Environment

`RESEND_API_KEY`, `EMAIL_FROM`, `QUO_API_KEY`, `QUO_FROM_NUMBER`, `TEST_RECIPIENTS_EMAIL`,
`TEST_RECIPIENTS_SMS`, `NOTIFICATIONS_SECRET`, `APP_NAME` (shown in emails and texts).

## Removing the module

Delete `notifications/`, `messaging/`, `actions/notifications`, the `modules.ts` line, the notification
routes and nav rows; automations' message steps (`steps.ts`) call `notify`, so remove them too (or the
automations module with it).
