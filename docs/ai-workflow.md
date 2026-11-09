# How AI builds this app

Every line is written by AI. AI follows written rules most of the time, not every time, so the rules
in AGENTS.md are also **checked by machines**. A failing check says which rule it is, why it exists
and how to fix it. Read the message and fix the cause; don't silence it.

## The checks (all in `pnpm check` and CI)

| Check                                                 | What it catches                                                                                                     | Where                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `pnpm rules`                                          | the rule ids below, plus files over 750 lines                                                                       | `scripts/check-rules.mjs`                      |
| `pnpm actions:tests`                                  | an action with no test where it **works** (the "refused" test is automatic)                                         | `packages/core/scripts/check-action-tests.ts`  |
| `pnpm test`                                           | behaviour against a real Postgres; `refusals.test.ts` proves every non-public action refuses callers without access | `packages/core/test/`                          |
| `pnpm lint`                                           | oxlint (`.oxlintrc.json`: correctness, React hooks, jsx-a11y, Next, import) plus `tsc` per package                  | `.oxlintrc.json`, each package's `lint` script |
| `pnpm knip`                                           | files nothing imports, unused / unlisted dependencies (exports are left alone: they are the API)                    | `knip.json`                                    |
| `pnpm e2e`                                            | the real app in a real browser: admin flows, error pipeline, keyboard, dark mode, 320px, axe accessibility          | `apps/web/e2e/` (docs/testing.md)              |
| typecheck, format, `actions:docs --check`, migrations | the usual, plus stale generated files                                                                               | `package.json`, `.github/workflows/ci.yml`     |

`pnpm rules` checks:

- `no-db-in-web`: `apps/web` never imports `@app/db`, `drizzle-orm`, `postgres`, `pg` (rule 1).
- `no-provider-client-for-data`: provider clients (Supabase JS, Neon Data API / PostgREST) only in
  `apps/web/lib/auth/` and `proxy.ts`, never `.from()` / `.rpc()` / `.storage`, never `/rest/v1` (rule 9).
- `app-schema-only`: no `pgTable()`, no tables in `public` (rule 10).
- `no-raw-colour`: no hex/rgb/oklch/`color-mix` and no Tailwind palette classes in `apps/web` (rule 4).
- `icons-from-ui-only`: no icon library imports outside `packages/ui/src/components/icons.tsx` (rule 4).
- `no-browser-dialog`: no `window.confirm` / `prompt` / `alert` (rule 4).
- `no-swallowed-error`: every `catch` / `.catch()` rethrows, calls `reportError`, uses the error, or
  explains in a comment why failing there is expected; console logging doesn't count (rule 6).
- `send-via-notify`: `sendEmail`/`sendSms` only inside `packages/core/src/{messaging,notifications}` (rule 8).
- `emit-notify-in-actions`: `emit`/`notify` are not imported in `apps/web` (rules 7, 8).
- `no-next-safe-action`: no `next-safe-action` / `authActionClient`; use `defineAction` + `<ActionForm>`.
- `app-time-zone-dates`: no `toLocaleDateString()` etc. without `timeZone` in `apps/web`; configurable
  in `CONFIG.dates` (switch it off if the app shows no dates).
- `track-new-tables`: every `app` table calls `app.track_changes` or is on the reasoned list (rule 5).
- `migrations-are-final`: a migration on `origin/main` was not changed, renamed or deleted (rule 5).
- `file-size`: no source file over 750 lines (tests 1,000); split by responsibility.

**Escape hatch:** `// rules-ok: <rule-id> — <reason>` on the line or the line above. Use it only when
a reviewer would agree. **Configuration** (scope name, date helper, paths) is the `CONFIG` object at the
top of `scripts/check-rules.mjs`. **Adding a rule:** when an AI makes the same mistake twice, add a check
with a message that explains the fix; prove it fires by planting a violation, then remove the plant.

## Every action is tested

`packages/core/test/action-coverage.ts` records every action the tests run and how it ended.
`pnpm actions:tests` requires, for every action, one run that **worked** (in the area's test file) and
one that was **refused** (automatic for every non-public action in `refusals.test.ts`).

## Lint and dead code

`pnpm lint` runs `oxlint` with the root `.oxlintrc.json` in every package (and in `scripts/`, `.claude/`),
then `tsc`. Errors are bugs (rules of hooks, a11y, unused code, duplicate imports); a few React-compiler
style rules are warnings. Fix the cause; a justified exception is `// oxlint-disable-next-line <rule> -- <why>`.
CI runs lint, knip and the e2e suite as separate jobs (`.github/workflows/ci.yml`).

## Claude Code setup (`.claude/`)

- **Skills:** `add-action`, `add-migration`, `add-screen`, `add-notification`, `fix-error`,
  `finish-change`, `new-project-from-boilerplate`. Claude loads them when a task matches.
- **Hooks** (on in `.claude/settings.json`):
  - `session-start.sh`: in cloud sessions installs packages (only when a manifest or the lockfile
    changed), starts local Postgres 16 (`/usr/lib/postgresql/16/bin`), runs migrations, sets
    `DATABASE_URL`, fetches `origin/main`.
  - `guard.mjs`: blocks migrations/seeds/SQL against anything but a local database, force-pushing or
    deleting `main`/`dev`, `--no-verify`, editing generated files and editing a migration already on `main`.
  - `format.mjs`: runs Prettier on every file Claude edits.
- **Permissions:** check/test/format/git-read commands are pre-approved; force-push, pushing straight to
  `main` and reading `.env` files are denied.

## AI review

`.github/workflows/ai-review.yml` (optional): a second AI reviews every pull request against AGENTS.md
and comments; it never approves or merges. Off until the `ANTHROPIC_API_KEY` secret is set. Delete the
file if you don't want it.
