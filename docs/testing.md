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

## End-to-end (optional)

Browser tests (Playwright) against the **built** app and a seeded database live in `apps/web/e2e/`
if you add them: public pages, sign-in redirects, the REST API. Build, seed, then run:

```bash
pnpm db:migrate && pnpm db:seed && pnpm --filter web build && pnpm --filter web e2e
```

Check phone width (320px) for any screen you add.
