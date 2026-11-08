---
name: add-notification
description: Tell a customer or staff member something — an email, text, push or inbox message (receipts, reminders, alerts). Use whenever a feature needs to notify someone.
---

# Adding a notification

Rule 8: telling someone something = `notify(tx, …)` inside the action. Never call `sendEmail` /
`sendSms` yourself (`pnpm rules` fails outside `packages/core/src/notifications/`), and never text
anyone without recorded consent — `notify` checks it for you. Overview: docs/architecture.md →
Notifications.

1. **Add the type** to `packages/core/src/notifications/` (customer or staff types file, next to
   similar ones) and list it in `registry.ts`:
   - `key`: `area.event` (`project.dueSoon`, `staff.newError`).
   - `audience`: `customer` (the contact it is about) or `staff` (+ `permission` — everyone with it).
   - `label` + `description`: shown in notification settings ("When a project is due tomorrow").
   - `defaults`: `{ email, sms, push }`. SMS on only when it is time-critical.
   - `required: true` only for transactional messages (receipts, cancellations, security) — never
     marketing. `urgent: true` only if it must ignore quiet hours.
   - `render(data, to)`: title, body, email subject, SMS text (short; the STOP line is added for
     you), link. Voice: plain, short, sentence case; say what happened and what to do next.
2. **Send it from the action**, inside its transaction, so nothing is sent for a change that did
   not save:
   ```ts
   await notify(tx, 'project.dueSoon', {
     to: contactId, // or { permission: 'projects.write' } for staff
     data: { … },
     subject: { type: 'project', id: project.id },
     dedupeKey: `${project.id}:${dueDate}`, // same key = sent once, even if the action re-runs
   });
   ```
   Scheduled ("a day before")? Follow the existing reminders and the cron route.
3. **Test it** in `packages/core/test/notifications.test.ts`: the inbox item exists, the right
   channels got deliveries, and SMS is skipped without consent.
4. **Docs:** add a row to the notification table in docs/architecture.md if you keep one, and the
   in-app help if customers see it.
5. `pnpm check`.
