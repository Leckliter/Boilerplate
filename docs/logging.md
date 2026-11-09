# The activity log — who did what, when, from where

Everything that happens in the system leaves a trail you can read in **Admin → Activity**, on each
contact's page, over REST, or through AI (MCP). It has two layers:

| Layer                            | Table              | Answers                                                                                                                                     |
| -------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Activity log** (what was done) | `app.activity_log` | Who (person, API key / AI, system, visitor), which channel (web, api, mcp, system, automation), from where, what, ok?, error ref, how long. |
| **Change log** (what changed)    | `app.change_log`   | For every row inserted, updated or deleted: the old → new value of each changed field.                                                      |

Each change-log row links to the activity entry that caused it
(`change_log.activity_id = activity_log.id`). "Ann changed Bo's phone from X to Y from 203.0.113.7
at 3:02 pm" is one activity entry plus one change row. A Postgres trigger,
`app.track_changes(table, subject_column, VARIADIC skip)`, writes the change rows, so it also
catches writes made outside the app (SQL editor, seed, a script); those show as "outside the app
(database user …)".

## What is recorded

| Event                                                                   | Recorded                           | How                           |
| ----------------------------------------------------------------------- | ---------------------------------- | ----------------------------- |
| Any change through an action: admin, portal, REST, MCP, webhook, script | Always, successful or not          | `runAction`                   |
| A change made by an automation step                                     | Always (channel `automation`)      | `runAction`                   |
| Any call by an **API key** (REST or MCP), reads included                | Always                             | `runAction`                   |
| A person or key trying something they're **not allowed** to             | Always (`error_code = forbidden`)  | `runAction`                   |
| Invalid input to a change                                               | Always (`invalid_input`)           | `runAction`                   |
| Sign-in, code emailed, wrong/expired code, sign-out, sign-up            | Always (`kind = auth`)             | `apps/web/lib/auth-events.ts` |
| Any write to any `app` table, even outside the app                      | Always, in the change log          | trigger `app.record_change`   |
| People **reading** pages in the apps                                    | No; it would drown everything else | —                             |

## Privacy and secrets

- Inputs are redacted before saving: any key that looks like a password, token, secret, key, OTP or
  card detail becomes `[redacted]`. Actions can choose exactly what to log with `logInput`.
- Secret columns are never copied into the change log (`app.track_changes(…, 'key_hash')`); neither
  are noisy bookkeeping columns (`updated_at`, `last_used_at`).
- A **failed** sign-in records the email typed but is not attributed to that person.

## Reading it

- **Admin → Activity**: filter by kind, channel, failures, search; click an entry for its field-level
  changes, input, IP and browser, and the other things done in the same request.
- **Contact page → History**: everything about that person.
- **Actions** (`activity.read`): `activity.list`, `activity.get`, `activity.changes` (a record's field history).

## Adding things

- **New action:** nothing to do. `runAction` logs it. Call `log({ subjectType, subjectId, summary })`
  with a human sentence so the log reads well.
- **New table:** track it in the same migration, or `pnpm test` and `pnpm rules` fail:
  ```sql
  SELECT app.track_changes('app.projects', 'contact_id');       -- history shows on the contact
  SELECT app.track_changes('app.things', 'id', 'secret_col');   -- never copy secret_col
  ```
  Only logs and queues may skip it, listed with reasons in `scripts/check-rules.mjs`.
- **New sign-in method:** record it with `recordAuthEvent`, only after confirming it server-side.

## Server log lines (`logger`)

Besides the audit trail, servers write **structured log lines**: `logger({ source, requestId })` from `@app/core`
prints one JSON object per line (`time`, `level`, `message`, `requestId`, your fields; secrets redacted with the same
rules as the activity log; an `Error` becomes `{ name, message, stack }`). `LOG_LEVEL` = `debug | info | warn |
error | silent` (default `info`). The cron routes, the webhook routes and the MCP route use it, with the request id
(`x-vercel-id`), so one request's lines line up with its activity rows and error reports. It is for tracing: anything
**unexpected** still goes to `reportError` ([errors.md](errors.md)); a log line is not an error inbox.

```ts
const log = logger({ source: 'webhook.resend', requestId });
log.info('handled', { type, eventId });
log.error('crashed', { ref, err });
```

## Retention

No action edits or deletes the log, with one exception: when a deletion request is carried out
(`account.processDeletions`) the personal fields of the person's contact are scrubbed from the change history
(`before` / `after`) and from the inputs of activity rows about them; who did what and when stays. Exporting the
log or contacts (`activity.exportCsv`, `contacts.exportCsv`) is itself logged. The daily maintenance job (`/api/cron/maintenance`, needs
`CRON_SECRET`) deletes only API/AI reads older than 365 days and rate-limit counters older than a
day. Changes, failed changes, denied attempts, sign-ins and the whole change log are kept forever.
Scheduled-job runs are recorded in `app.cron_runs`. Modules add their own daily steps with
`registerMaintenanceStep(name, fn)` (`account.deletions`, `events.retention`, `files.abandoned`); `runMaintenance()` returns what each did under `steps`. The ⌘K search works the same way: modules add results with `registerSearchProvider(name, fn, { order })` (`actions/search/providers.ts`).
