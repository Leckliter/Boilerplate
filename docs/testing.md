# Testing

Tests live in `packages/core/test` (Vitest) and run against a **real Postgres** — the same SQL the app
runs in production, no mocks of the database.

```bash
# any local Postgres 16 works; e.g. with Docker:
docker run -d --name app-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=app -p 5432:5432 postgres:16
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/app
pnpm db:migrate
pnpm test
```

The suite refuses to run unless `DATABASE_URL` points at localhost (it wipes data). CI
(`.github/workflows/ci.yml`) does exactly this with a Postgres 16 service, plus typecheck, lint,
rules, format, the action-docs check, a migration check and a production build. Cloud sessions get
Postgres from `.claude/hooks/session-start.sh`.

## What to test

Minimum for every action: one test where it works and one where it is refused. `pnpm actions:tests`
enforces both from what the last `pnpm test` recorded:

- **Refused**: `test/refusals.test.ts` calls every non-public action as someone without its
  permission (signed out, for "authenticated" ones). Nothing to write.
- **Works**: write it in the area's test file (or `test/happy-paths.test.ts` for tiny actions).
- A mutation with rules (who may, which states) gets tests for those refusals too, not just the happy path.
- Logging: `test/logging.test.ts` fails if an `app` table has no `track_changes` trigger.
- An error fix starts with a failing test that uses the report's input ([errors.md](errors.md)).

Call actions through `runAction` / `callAction` with a test actor; never reach into tables to
assert more than the result and what the database shows afterwards. Add a new table to the reset
list in `test/setup.ts`.

## Unit tests in `apps/web`

`pnpm --filter web test` (Vitest, `apps/web/vitest.config.ts`): code that needs neither a browser nor a
database, mainly the auth adapters with mocked SDKs (`lib/auth/*.test.ts`). `server-only` is stubbed and
`@/` resolves to `apps/web`. Business logic is NOT tested here: it lives in `packages/core`.

## End-to-end (Playwright)

`apps/web/e2e/` drives a real browser against the real app and a real, throw-away database:

```bash
pnpm e2e                 # = pnpm --filter web e2e: starts everything itself
pnpm e2e -- admin-users  # one spec file; add --headed / --ui to watch
```

What it does (`playwright.config.ts`, `scripts/e2e-db.mjs`): drops and recreates a database named
`<DATABASE_URL's name>_e2e` (or `app_e2e` on the local test Postgres: `node packages/db/scripts/test-db.mjs`),
migrates and seeds it, starts `next dev` on port 3100 with `DEV_LOGIN=1 BACKEND=neon`, warms the main
routes, closes the owner's one-time welcome dialog, then runs the specs. It is `next dev` and not
`next start` because dev login is refused by production builds. The dev server writes to `.next-e2e`, so
it never fights `pnpm dev`. `E2E_BASE_URL` is ignored by `pnpm e2e` (it is for `e2e:test-site`).

Signing in: `signInAs(page, email)` in `e2e/support/auth.ts` (`/api/dev-login`). Seeded people:
`owner@example.com` (the only owner), `admin@`, `manager@`, `staff@`, `casey@example.com` (customer).
Specs share one database and run in parallel: create your own records with `uniq()` names instead of
editing seeded ones, and never remove the owner's role (one spec proves the last owner is protected).

| Spec          | Covers                                                                                                                                                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public`      | public pages, sign-in form, redirects for signed-out visitors, 401 / 403 from the APIs                                                                                                                                                          |
| `admin-users` | dashboard, New user dialog (no / field error / `E-` reference / success), edit in place, field history, roles, last-owner guard, Activity before/after                                                                                          |
| `errors`      | the error pipeline: reference shown → Admin → Errors → "Copy for AI agent" (reference + `## Stack`) for a page bug, a server crash, a client crash, a timer error, a failing route                                                              |
| `account`     | profile edit, cancel, sign out                                                                                                                                                                                                                  |
| `navigation`  | keyboard-only: skip link, sidebar, command palette (Ctrl+K, arrows, Escape); dark mode persistence with no flash                                                                                                                                |
| `responsive`  | no sideways scroll at 320px on every main route                                                                                                                                                                                                 |
| `a11y`        | axe-core (WCAG A/AA) on the main screens in light and dark; zero serious/critical (the `KNOWN` allow-list is empty and a new entry needs a reason and a TODO item)                                                                              |
| `crawl`       | opens every public, account and admin page and one record of each kind, clicks the whole admin sidebar; fails on any console error/warning, page error, failed request or 5xx                                                                   |
| `files`       | document upload / open / delete on a user, profile picture, "download my data", against the local S3 stand-in (`scripts/dev-s3.mjs`, started by the config; docs/files.md)                                                                      |
| `features`    | contact form → admin inquiry, newsletter sign-up, bulk archive with confirm, CSV import dry run, ⌘K record search, feature flag, "Add setting", welcome wizard, bell, deleting an account, push states (mocked `Notification` / service worker) |

The crashes come from dev-only routes in `apps/web/app/api/dev/` (`boom`, `crash`, `crash/client`): each
404s unless `DEV_LOGIN` is on in a non-production build.

`pnpm e2e:test-site` runs the same specs against `E2E_BASE_URL` (a deployed test site; no server or
database is started). Specs that need dev login skip themselves where it is off.

Browsers: `npx playwright install chromium` once (CI does it). In the cloud sandbox the config falls back
to any Chromium under `PLAYWRIGHT_BROWSERS_PATH`; or set `PLAYWRIGHT_CHROMIUM_PATH`.

Rules for new specs: select by role and accessible name (it doubles as an a11y check); never `sleep`
(wait for a URL, a role or text); check phone width for a new screen; a spec that finds a bug in the app
is a good spec: fix the app, or `test.fixme` it with a TODO.md item, never loosen it.

Console and network problems: `e2e/support/watch.ts` collects console errors/warnings, page errors, failed
requests and 5xx answers; attach it (`const w = watch(page)`) and assert `w.problems` is empty. Server-side
errors (a React Server Components render failure the browser never sees) show in the web server's output
that `pnpm e2e` prints as `[WebServer] ⨯ …`: read it after a run.

## Script tests

`pnpm test:scripts` (Node's test runner): `scripts/new-project.test.mjs` runs the new-project script on a
copy of the repo and typechecks the result against an untouched copy (about a minute;
`NEW_PROJECT_SKIP_TYPECHECK=1` skips that part); `scripts/dev-s3.test.mjs` checks the local S3 stand-in.

Check phone width (320px) for any screen you add.
