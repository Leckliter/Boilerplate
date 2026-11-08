# TODO

Open work. Tick items when done; add new ones. Owner-only items (dashboards, keys, decisions) are
under **Owner**. Moving to a new project? Skill `new-project-from-boilerplate`.

## Owner

- [ ] Choose the backend (Neon or Supabase — docs/choosing-a-backend.md), create the project, set
      `BACKEND`, `DATABASE_URL` and the auth + `S3_*` variables in the host and `.env`.
- [ ] Set `OWNER_EMAILS` (the first sign-in with a listed email becomes the owner).
- [ ] Set `RESEND_API_KEY` (email) and, if you text customers, `QUO_API_KEY` plus a registered
      sender; set `TEST_RECIPIENTS_*` on every non-production environment.
- [ ] Set `CRON_SECRET` and schedule the cron routes on the host.
- [ ] Optional: add the `ANTHROPIC_API_KEY` repository secret to turn on `.github/workflows/ai-review.yml`.
- [ ] Optional: protect `main` (require PR + the CI check) in the repository settings.

## Code

- [ ] Rename `@app` and the display name; replace the brand ramp and logo (skill
      `new-project-from-boilerplate`).
- [ ] Delete the modules you do not need (docs/architecture.md → Modules).
- [ ] Replace the placeholder README/AGENTS intro with your own product description.
- [ ] Run `pnpm check` on a fresh clone and fix anything environment-specific.
