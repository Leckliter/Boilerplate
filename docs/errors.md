# Error reports — from "something went wrong" to a fix

When something breaks, the person sees an **error reference**, for example `E-7K3QX9MD`. Server page
crashes may show Next.js's numeric digest instead. Hand that reference to an AI agent. It can look up
what broke, where, for whom, with which input, in which deployed commit, how often, and a
**diagnosis** saying what kind of failure it is and where to look.

## The reference, the diagnosis and the fingerprint

| Part            | Example            | What it's for                                                                                                                                                                    |
| --------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reference**   | `E-7K3QX9MD`       | One occurrence. Points at the full report: stack, input, who, when, commit.                                                                                                      |
| **Diagnosis**   | `db.missing_table` | What kind of failure, plus a hint ("the migration wasn't applied here"). Rules live in `packages/core/src/errors/diagnose.ts`; add one whenever a fix teaches something general. |
| **Fingerprint** | `eb9279459408d2d7` | Same bug → same fingerprint, so 40 occurrences are one row with a count, and "mark fixed" closes them all.                                                                       |

## What gets reported

Only **unexpected** failures: bugs and outages. "You don't have permission", "that email is taken"
and "not found" are `ActionError`s: normal answers, visible in the [activity log](logging.md) but
not error reports.

| Where it broke                                          | Caught by                                                         | `source`  |
| ------------------------------------------------------- | ----------------------------------------------------------------- | --------- |
| Inside an action (UI, REST, MCP, webhook, script)       | `runAction`                                                       | `action`  |
| A page, layout, route handler or server action crashing | `apps/web/instrumentation.ts` (`onRequestError`)                  | `request` |
| Browser code: error pages, event handlers, promises     | `app/error.tsx`, `instrumentation-client.ts` → `POST /api/errors` | `client`  |
| Anything else (scripts, jobs, route handlers you wrote) | `reportError(err, { source: 'job', … })`                          | `job` …   |
| A provider webhook that crashed outside its action      | `handleWebhook` in `apps/web/app/api/webhooks/_lib/handle.ts`     | `webhook` |
| A cron module step or tick that threw                   | the cron routes / `runMaintenance` (the step name is in context)  | `job`     |

Each report is a row in `app.error_events`: message, stack and `cause` chain, the action and its
redacted input, the actor, IP, browser, request id, environment, the deployed commit and the
diagnosis. If the database itself is down the report goes to the server log instead (search for the
reference). A browser tab older than the deploy fails with Next's `UnrecognizedActionError`; that is
shown as a **Reload** toast, not reported.

**Alerts** (to everyone with `errors.manage`): a `staff.newError` notification for the first
occurrence of a fingerprint, and `staff.errorSpike` when an open bug happens 10 times in 15 minutes.

A webhook answers `500` with the reference after a crash, so the provider retries; a bad signature (`401`) or an
unreadable body (`400`) is a normal answer, logged but not reported. The matching structured log line carries the same
`ref` ([logging.md](logging.md) → Server log lines).

## How people see it

- **Pages:** `app/error.tsx`, `global-error.tsx` and per-area `error.tsx` show "Something went wrong"
  with the reference and a copy button.
- **Forms and buttons** (`<ActionForm>`, `useAction`): the toast says `… Error reference: E-…` with a **Copy reference** button.
- **REST / MCP:** `{ ok: false, error: { code: 'internal', message, ref } }`.
- **Admin → Errors** (`errors.manage`): grouped list. Open one for the full report, **Copy for AI agent**, **Mark fixed**.

## The brief

`errors.get` `{ ref }` returns the report and `brief`: Markdown starting `# Error E-…` with sections
Diagnosis (code + hint), Where (action / route, environment, commit), Who, Input (redacted),
Occurrences (count, first/last seen, fingerprint), Message and Stack. Paste it into a chat or fetch it:

```bash
curl -s -X POST "$APP_URL/api/v1/actions/errors.get" \
  -H "Authorization: Bearer $APP_API_KEY" -H 'Content-Type: application/json' \
  -d '{"ref":"E-7K3QX9MD"}' | jq -r .data.brief
```

`APP_URL` is the site; `APP_API_KEY` an owner/admin API key. Over MCP the tool is `errors_get`.

## Fixing one with an AI agent

1. Get the brief (above, or **Admin → Errors → Copy for AI agent**).
2. The agent follows `.claude/skills/fix-error/SKILL.md`: read the diagnosis, find the code at the
   deployed commit, reproduce in a test, fix, `pnpm check`.
3. After it ships: `errors.resolve { ref, resolution }` or **Mark fixed**. If it comes back, it reopens.

## Stack traces in production

The server bundle is built unminified (`experimental.serverMinification: false`), so frames name real
functions. Paths point into `.next/` bundles, so use the function name, action name and route.

## Code map

| What                 | Where                                                              |
| -------------------- | ------------------------------------------------------------------ |
| Table                | `packages/db/src/schema/errors.ts`                                 |
| Report / fingerprint | `packages/core/src/errors/report.ts`                               |
| Diagnosis rules      | `packages/core/src/errors/diagnose.ts`                             |
| Actions (`errors.*`) | `packages/core/src/actions/errors/`                                |
| Server crash hook    | `apps/web/instrumentation.ts`                                      |
| Browser reporting    | `apps/web/instrumentation-client.ts`, `app/api/errors/route.ts`    |
| Error pages          | `apps/web/app/error.tsx`, `global-error.tsx`, per-area `error.tsx` |
| Admin screens        | `apps/web/app/admin/errors/`                                       |
| Tests                | `packages/core/test/logging.test.ts`                               |
