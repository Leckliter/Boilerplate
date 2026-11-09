# TODO

Open work. Tick items when done; add new ones. Owner-only items (dashboards, keys, decisions) are
under **Owner**. Moving to a new project? Skill `new-project-from-boilerplate`.

## Owner

Nothing below can be done by code: each needs an account, a key or a decision.

- [ ] **Backend and database.** Choose Neon or Supabase ([docs/choosing-a-backend.md](docs/choosing-a-backend.md)), create the
      project, set `BACKEND`, `DATABASE_URL` and that provider's auth variables (`NEON_AUTH_*` or
      `NEXT_PUBLIC_SUPABASE_*`) in the host and `.env`. Create a second (test) database for `dev`.
- [ ] **File storage.** Create a bucket and set `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
      (and `S3_PUBLIC_URL` if public files should be served from a CDN). Check that the bucket allows `PUT`
      from your site's origin (CORS) or uploads fail in the browser. Locally `node scripts/dev-s3.mjs` stands in.
- [ ] **Owner and cron.** Set `OWNER_EMAILS` (the first sign-in with a listed email becomes the owner), and
      `CRON_SECRET`; schedule `/api/cron/jobs` (every minute) and `/api/cron/maintenance` (daily) on the host.
- [ ] **Email.** Create a Resend account, verify the sending domain (SPF/DKIM), set `RESEND_API_KEY` and `EMAIL_FROM`.
- [ ] **Email webhook.** In Resend add a webhook to `https://<your domain>/api/webhooks/resend` and set its `whsec_…`
      signing secret as `RESEND_WEBHOOK_SECRET` (bounces and complaints stop us mailing an address).
- [ ] **Texts (only if you text people).** Quo account, a registered sender number (US: 10DLC registration takes
      days), `QUO_API_KEY`; webhook to `/api/webhooks/quo` with its key as `QUO_WEBHOOK_SECRET` (STOP replies).
- [ ] **Web push.** Run `npx web-push generate-vapid-keys`; set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and
      `VAPID_SUBJECT` (a `mailto:` or `https:` URL). Without them the push card says "not set up".
- [ ] **Test sites.** Set `TEST_RECIPIENTS_EMAIL` / `TEST_RECIPIENTS_SMS` on every non-production environment so
      nothing reaches real customers; set `DEV_LOGIN` only on local machines.
- [ ] **Bot check (optional).** Cloudflare Turnstile keys for the public forms (`humanCheck`; docs/notifications.md).
- [ ] **Brand.** Replace the placeholder name (`APP_NAME`, Admin → Settings), the brand colour (one token,
      docs/design-system.md), the logo artwork (`packages/ui/src/components/logo.tsx`) and the favicon / OG image.
- [ ] **Domains.** Point the production and test domains at the host, set `NEXT_PUBLIC_APP_URL` on each, and add
      the domain to the auth provider's allowed redirect / trusted origins list.
- [ ] **Legal text.** Replace the placeholder terms and privacy pages (`apps/web/app/(site)/terms`, `privacy`) and
      the SMS consent wording (`smsConsentText`) with your own; have them reviewed.
- [ ] **Repository.** Replace `@your-github-username` in `.github/CODEOWNERS` and the URL in
      `.github/ISSUE_TEMPLATE/config.yml`; protect `main` (require a PR and the CI check); optional
      `ANTHROPIC_API_KEY` repository secret turns on `.github/workflows/ai-review.yml`.
- [ ] **Real-provider smoke test.** Once the keys above are set, on the test site: sign in with a real email code,
      send yourself a test notification on every channel, upload a file and an avatar, request a data export.
      (The suite runs on a local database, a local S3 stand-in and mocked providers; none of these services
      has been exercised for real.)

## Code

- [ ] Rename `@app` and the display name; replace the brand ramp and logo (skill
      `new-project-from-boilerplate`).
- [ ] Delete the modules you do not need (docs/architecture.md → Modules).
- [ ] Replace the placeholder README/AGENTS intro with your own product description.
- [ ] Run `pnpm check` and `pnpm e2e` on a fresh clone and fix anything environment-specific.
- [ ] Modules are not cleanly deletable: `maintenance.ts` and `actions/search` import module internals; tests
      `webhooks`, `leads`, `data-tools`, `account-data` read the `events` table. (`scripts/new-project.mjs` removes
      automations, docs and brand today; see docs/decisions.md.)
- [ ] Real Web Push, SMS and email sends are covered only by fakes and mocks; add provider sandbox tests when keys exist.

## Done in the 2026-11-09 pass

- [x] Role editor no longer preselects a role (it was `owner`); a failed form shows its reference once.
- [x] Accessible names: logo links, avatar button ("OO – My account"), roles table, brand demos, workspace tabs
      (`New tab` / `Close tab` sit beside the tablist via `<Tabs trailing>`), hero contrast, brand colour tiles. The a11y `KNOWN` list is empty.
- [x] Newsletter links redirect (303) to `/newsletter/confirmed` and `/unsubscribed`; one-click POST stays JSON.
- [x] Server dates follow the person's `tz` cookie (`getServerDates()`); client components use `useDates()`.
- [x] Icons `RocketLaunchIcon`, `InboxIcon`, `FileCsvIcon`; `labels` props on ThemeToggle, Wizard, Steps, NotificationList,
      DataTable with translated labels in the web app; Avatar `src`; Sparkline `width` / `height`.
- [x] Actions `errors.resolveMany`, `errors.occurrences`, `system.cronRuns`, `notifications.typeDefaults`,
      `notifications.preferencesFor`, `activity.list` `from` / `to`, used by the dashboard, errors, system, activity,
      settings and user pages.
- [x] Local S3 stand-in (`scripts/dev-s3.mjs`) and e2e specs for uploads, avatar, export, push states, forms, bulk
      archive, CSV import, palette, bell, privacy, flags and the wizard; a crawl spec that fails on console errors.
- [x] Bugs found by running the app: "Add setting" dialog crashed on open (server component passed a function to a client
      component); the bell did not update after "Send me a test"; data export links opened instead of downloading.
- [x] Command palette returns focus to its opener (the `test.fixme` is gone); oxlint and knip are clean and in `pnpm check`.
