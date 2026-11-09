# Deploying

The default target is **Vercel** (the web app) plus **Neon or Supabase** (database, sign-in, file
storage). The same app also runs as a Docker container on any host. Nothing here needs a code change:
it is project settings and environment variables.

```
git push ──► CI (.github/workflows/ci.yml): typecheck, lint, rules, format, tests, build, e2e, knip
   │
   ├─ pull request ──► Vercel preview ──► its own database branch (Neon / Supabase branch)
   ├─ dev branch ────► test site (test.example.com)   ← test here before main
   └─ main ──────────► production
```

## 1. Vercel

1. **Import the repository** in Vercel. Framework: Next.js. **Root Directory: `apps/web`** (the folder
   that holds `vercel.json`). Turn on "Include source files outside of the Root Directory" (the app
   imports the workspace packages). Node.js 22.
2. **Install command**: `pnpm install --frozen-lockfile` (Vercel finds the workspace from the lockfile).
3. **Build command** (this is where migrations run, see [Migrations](#4-migrations)):
   `cd ../.. && pnpm db:migrate && pnpm --filter web build`
4. **Environment variables**: add the [table below](#2-environment-variables) for Production, Preview
   and the test site (`dev` branch) separately. Never reuse production's database or keys elsewhere.
5. **Cron**: `apps/web/vercel.json` already lists the two scheduled routes ([Cron](#5-cron)). Set
   `CRON_SECRET` or they answer 401.
6. **Domains**: production on your domain, the `dev` branch on `test.<domain>`. Set
   `NEXT_PUBLIC_APP_URL` to the matching URL in each environment (emails and redirects use it).
7. **Protect `main`** in GitHub (require the CI check, no direct pushes) and in Vercel (production
   deploys only from `main`).

Check it: `GET /api/healthcheck` answers 200 when the database answers and every cron job has run
recently, and 503 otherwise (names and timings only, nothing secret). Point an uptime monitor at it.

## 2. Environment variables

`.env.example` lists every variable; **Admin → Settings → Integrations** shows which are missing on
the running site (names only, never values) and the boot check fails loudly for a malformed one.

| Variable                                                                                                                    | Where                         | Notes                                                                               |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------- |
| `BACKEND`                                                                                                                   | all                           | `neon` or `supabase` (docs/choosing-a-backend.md)                                   |
| `DATABASE_URL`                                                                                                              | all                           | Pooled connection string. Runtime queries.                                          |
| `DATABASE_URL_DIRECT`                                                                                                       | build / release               | Direct (non-pooled) string. Migrations use it when set. Neon: the non-pooler host.  |
| `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`                                                                             | `BACKEND=neon`                | Secret: 32+ random characters (`openssl rand -base64 48`)                           |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                                                 | `BACKEND=supabase`            | Public by design: RLS-on-no-grants means the anon key reaches nothing               |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`, `S3_FORCE_PATH_STYLE` | all                           | Object storage (Neon Object Storage / Supabase Storage S3 endpoint)                 |
| `NEXT_PUBLIC_APP_URL`                                                                                                       | all                           | Public URL of THIS environment. Baked into the browser bundle at build time         |
| `OWNER_EMAILS`                                                                                                              | production                    | Comma list: the first sign-in with one of these becomes the owner                   |
| `CRON_SECRET`                                                                                                               | all                           | 16+ random characters. Vercel Cron sends it as `Authorization: Bearer …`            |
| `RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET`                                                                     | when emailing                 | `EMAIL_FROM` must be on a domain verified in Resend                                 |
| `QUO_API_KEY`, `QUO_FROM_NUMBER`, `QUO_WEBHOOK_SECRET`                                                                      | when texting                  | A registered sender; never text without recorded consent                            |
| `TEST_RECIPIENTS_EMAIL`, `TEST_RECIPIENTS_SMS`                                                                              | **every non-production** site | Everything sent from a test site goes only to these addresses                       |
| `NOTIFICATIONS_SECRET`                                                                                                      | all                           | Signs unsubscribe links                                                             |
| `AUTOMATIONS_WEBHOOK_SECRET`                                                                                                | when using webhooks           | Signs outgoing automation webhooks                                                  |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`                                                                    | when using push               | `npx web-push generate-vapid-keys`                                                  |
| `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`                                                                    | optional                      | Bot check on public forms                                                           |
| `APP_NAME`, `APP_TIME_ZONE`, `LOG_LEVEL`                                                                                    | optional                      | Display name in emails; default `America/Chicago`; `info`                           |
| `DEV_LOGIN`                                                                                                                 | **never** in production       | Sign in as any email with code `000000`. Off in a production build whatever it says |

`NEXT_PUBLIC_*` values are compiled into the browser bundle, so change them → redeploy (a restart is
not enough). Turbo's cache key includes them (`turbo.json` → `build.env`); add a new variable there
when you add one the build reads.

## 3. Preview databases (branching)

A preview deployment must never touch production data.

- **Neon**: install the Vercel ↔ Neon integration. Each preview deploy gets its own database branch
  (a copy-on-write copy of the parent), and `DATABASE_URL`/`DATABASE_URL_DIRECT` are injected for it.
  The build command's `pnpm db:migrate` then migrates that branch, so the preview runs the PR's schema.
  Delete branches with the PR (the integration does this on merge/close).
- **Supabase**: enable Branching (GitHub integration); each PR gets a preview branch with its own
  URL and keys. Point the Preview environment's variables at them through the integration.
- **Either**: the test site (`dev`) has its own long-lived database; seed it with `pnpm db:seed`
  (it refuses production). Auth users do not travel with a branch copy on Supabase: sign in again.

## 4. Migrations

Migrations are Drizzle SQL files in `packages/db/migrations`, applied in order, once, forward only.

- **On deploy, from the build** (the default): the build command runs `pnpm db:migrate` against
  `DATABASE_URL_DIRECT` (else `DATABASE_URL`) before `next build`. If a migration fails the build
  fails and the previous deployment keeps serving. This is safe because the previous code still works
  with the new schema **if every migration is backwards compatible** (below).
- **As a release step** (alternative, for hosts without a build hook, or to review before applying):
  run `pnpm db:migrate` from CI or by hand against the target, then deploy. In Docker:
  `docker compose run --rm migrate`.
- **Never** run migrations by hand against a hosted database from your laptop, and never edit an
  applied migration (`pnpm rules` → `migrations-are-final`): write a new one.
- **Expand, then contract.** One deploy adds (a nullable column, a new table, an index); the code
  starts using it; a LATER deploy removes what is unused. A rename is add + copy + switch + drop over
  three deploys. This is what makes rollback safe.

## 5. Cron

`apps/web/vercel.json`:

| Route                   | Schedule                   | What it does                                                           |
| ----------------------- | -------------------------- | ---------------------------------------------------------------------- |
| `/api/cron/jobs`        | every minute (`* * * * *`) | Background jobs, notification sends and retries, scheduled automations |
| `/api/cron/maintenance` | daily 04:17 UTC            | Housekeeping: retention, expiring tokens, daily module steps           |

Both require `Authorization: Bearer $CRON_SECRET` (Vercel sends it when the variable is set). Vercel's
Hobby plan only allows daily crons: on Hobby change `jobs` to `0 * * * *`-style or call it from an
external scheduler (any service that can send the header). Each run is recorded in `cron_runs`;
`/api/healthcheck` and Admin → System show a job that has not run on time.

## 6. Docker (any host)

```bash
docker build -t app-web \
  --build-arg NEXT_PUBLIC_APP_URL=https://app.example.com .
docker run --rm -p 3000:3000 --env-file .env.production app-web
```

The `Dockerfile` has three stages (install → build with `NEXT_OUTPUT=standalone` → a small non-root
runtime on `node apps/web/server.js`) and a health check on `/login`. Migrations are not baked in: run
them as a release step against the same database. `docker-compose.yml` runs Postgres 16 + the web
image (and Mailpit with `--profile mail`) for a local production-like stack.

Behind a proxy, forward `X-Forwarded-For` and `X-Forwarded-Host` (rate limits and the same-origin check
on `/api/errors` read them), and run more than one instance only on shared Postgres (everything stateful
is in the database).

## 7. Releases

Version = the root `package.json` `version`. To release: `pnpm version:set 1.2.0` in a PR, merge it,
then tag `v1.2.0` on `main` and push the tag. `.github/workflows/release.yml` checks the tag equals the
version and publishes a GitHub release with notes grouped from the commit subjects
(`feat:`, `fix:` …, `scripts/release-notes.mjs`). It does not deploy: Vercel deploys `main` itself.

## 8. Rollback

1. **Code**: Vercel → Deployments → the last good one → **Instant Rollback** (or
   `vercel rollback`). The Docker equivalent is running the previous image tag. This takes seconds.
2. **Database**: do not undo migrations. Because migrations are expand-then-contract, the previous code
   runs on the newer schema. If a migration itself was wrong, fix it **forward** with a new migration.
   If data was damaged, restore from the provider's point-in-time recovery (Neon: restore a branch to a
   timestamp; Supabase: PITR / daily backup) into a NEW branch/project, check it, then switch over;
   do not restore over production blind.
3. **Find the cause**: the error references (`E-…`) of the bad deploy are in Admin → Errors with the
   commit that produced them; "Copy for AI agent" hands one to Claude (skill `fix-error`).
4. Write the test that would have caught it before redeploying.

## 9. Checklist for a new environment

- [ ] `BACKEND`, `DATABASE_URL`, `DATABASE_URL_DIRECT`, the provider's auth variables, `S3_*`
- [ ] `NEXT_PUBLIC_APP_URL` equals the real URL; `OWNER_EMAILS` (production)
- [ ] `CRON_SECRET`; first cron run visible in Admin → System
- [ ] `TEST_RECIPIENTS_*` on every non-production site
- [ ] Provider dashboard set up (redirect URLs, email templates: docs/choosing-a-backend.md → Provider setup)
- [ ] `GET /api/healthcheck` is 200; sign in; the owner sees Admin
- [ ] An uptime monitor on `/api/healthcheck`; error alerts reach the owner (docs/errors.md)
