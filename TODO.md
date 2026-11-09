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
- [ ] Replace `@your-github-username` in `.github/CODEOWNERS` and the URL in `.github/ISSUE_TEMPLATE/config.yml`.
- [ ] Optional: protect `main` (require PR + the CI check) in the repository settings.

## Code

- [ ] Rename `@app` and the display name; replace the brand ramp and logo (skill
      `new-project-from-boilerplate`).
- [ ] Delete the modules you do not need (docs/architecture.md → Modules).
- [ ] Replace the placeholder README/AGENTS intro with your own product description.
- [ ] Run `pnpm check` on a fresh clone and fix anything environment-specific.

## Found by lint, knip and the e2e suite (2026-11-09)

- [ ] Command palette does not return focus to the button that opened it after Escape (`navigation.spec.ts` is `test.fixme`).
- [ ] Axe serious/critical still open (`KNOWN` in `apps/web/e2e/a11y.spec.ts`; remove entries as fixed): Logo link `aria-label="App home"` vs visible "App"; hero text contrast 4.35:1 on `/`; "Open pages" tablist holds a non-tab button; avatar button `aria-label="My account"` vs visible initials; `/brand` demos (meter/progress/radio/slider/masked-input names, `aria-label` on a span, 10px muted text, calendar day labels).
- [ ] oxlint errors in other areas (`pnpm lint`): `rules-of-hooks` in `packages/ui/src/components/{tabs,radio}.tsx`; unused imports in `ui/{page,switch}.tsx`, `db/schema/{contacts,files}.ts`, `web/app/(site)/pricing`, `app/not-found.tsx`, `app/account/page.tsx`; jsx-a11y in `ui` (`card`, `detail-list`, `input-group`, `tag-input`, `calendar`, `editable-card`, `avatar-upload`).
- [ ] knip: unused files in `packages/core/src` (`logger.ts`, `actions/contacts/lead.ts`, `actions/{inquiries,newsletter}`, `{inquiries,newsletter}`); unused deps `@app/db`, `@modelcontextprotocol/sdk` in `apps/web`. Then add `pnpm knip` to `check`.
- [ ] Modules are not cleanly deletable: `maintenance.ts` and `actions/search` import module internals; tests `webhooks`, `leads`, `data-tools`, `account-data` read the `events` table.
- [ ] Role editor defaults "Role to grant" to `owner`, the most powerful role.
- [ ] A failed form shows the reference twice (inside the message and again in the reference box).
