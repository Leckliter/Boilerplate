# Boilerplate — agent guide

A copy-and-own starter for a digital-first business app: public site, customer portal, admin
and a REST/MCP API, all over **one set of business actions**. The owner copies these files into a
new repo and renames/rewrites freely (skill `new-project-from-boilerplate`). ONE Next.js app serves:

| Surface         | URL        | Who                                  | Code                    |
| --------------- | ---------- | ------------------------------------ | ----------------------- |
| Website + auth  | `/`        | everyone (`/login` signs in)         | `apps/web/app/(site)/`  |
| Customer portal | `/account` | anyone with a login (staff included) | `apps/web/app/account/` |
| Admin           | `/admin`   | roles with `admin.access`            | `apps/web/app/admin/`   |

Also: `/docs` (help), `/brand` (living style guide), `/api/v1/actions` (REST), `/api/mcp` (MCP for AI).
The scope `@app/*` is a placeholder: the owner renames it with find/replace.

## Read first

1. [docs/README.md](docs/README.md) — index of every developer doc. Always read
   [architecture.md](docs/architecture.md), [actions.md](docs/actions.md) (**the** rule for business
   logic) and [ai-workflow.md](docs/ai-workflow.md) (the checks that enforce these rules); then the doc
   for the area you are changing ([logging.md](docs/logging.md), [errors.md](docs/errors.md),
   [choosing-a-backend.md](docs/choosing-a-backend.md) …). Building UI:
   [design-system.md](docs/design-system.md) and `/brand`.
2. [TODO.md](TODO.md) — open work, and what only the owner can do. Tick items when done; add new ones.
3. [docs/decisions.md](docs/decisions.md) — why things are the way they are. Don't re-decide
   something listed there without the owner.
4. [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) — the contract the boilerplate was built to.

## Skills (use them — `.claude/skills/`)

`add-action` (any data read/write) · `add-migration` (schema) · `add-screen` (any UI) ·
`add-notification` (telling someone something) · `fix-error` (an `E-…` reference) ·
`finish-change` (before every commit) · `new-project-from-boilerplate` (rename, pick a backend,
delete unused modules).

## The rules (non-negotiable)

1. **All business reads/writes go through an action** (`packages/core/src/actions`). UI, REST, MCP
   and scripts call actions; `apps/web` never imports `@app/db`, `drizzle-orm` or `postgres`. Never
   put permission checks in UI code only.
2. **Tags describe, roles grant.** A tag (customer, lead, staff…) never unlocks anything. Access =
   roles + `packages/core/src/access/permissions.ts`.
3. **One person = one contact.** Never create a second table of people (no `users`, `customers`,
   `employees`, `profiles` tables). Logins live with the auth provider and link via
   `app.contacts.auth_user_id` (TEXT, so it fits Neon and Supabase ids).
4. **UI uses `@app/ui` components and tokens only.** No raw hex/rgb/oklch, no Tailwind palette
   classes, no one-off buttons, icons only from `@app/ui/components/icons`. New component → add it
   to `packages/ui` AND `/brand`.
5. **Schema changes = Drizzle migration** (`pnpm db:generate`), never manual SQL on a hosted
   database. Never edit an applied migration. A new table must record its changes:
   `SELECT app.track_changes('app.<table>', '<subject column>')` in a custom migration.
6. **Never swallow an unexpected error.** Actions are covered by `runAction`; anywhere else,
   `catch` → `reportError(err, { source, … })` and show the returned reference. Expected failures
   are `ActionError`s with a clear message.
7. **Something worth reacting to happened = `emit(tx, 'type', …)`** inside the action, so
   automations can start, wait or stop on it. New event → `packages/core/src/events/catalog.ts`.
8. **Telling someone something = `notify(tx, 'type', …)`** inside the action, so preferences,
   consent, retries and the delivery log apply. Never text anyone without recorded consent.
   Low-level sends (`sendEmail`, `sendSms`) live in `@app/core/messaging` behind the test-recipient guard.
9. **Data goes only through Drizzle over `DATABASE_URL`**, inside actions. Never the Supabase JS
   client or the Neon Data API / PostgREST for data. A provider client is imported only in
   `apps/web/lib/auth/` for sign-in, so Neon and Supabase stay interchangeable
   ([choosing-a-backend.md](docs/choosing-a-backend.md)).
10. **Our tables live in the `app` schema**, RLS on, no grants to `anon`/`authenticated`. Never
    create business tables in `public`.
11. After changing actions or events run `pnpm actions:docs` and commit the result. When a screen
    or process changes, update its doc in the same change. Money is always integer cents.
    Server actions are not written with `next-safe-action`: logic is `defineAction`, forms are
    `<ActionForm>`.

`pnpm rules` checks these mechanically (rule ids: `no-db-in-web`, `no-provider-client-for-data`,
`app-schema-only`, `no-raw-colour`, `icons-from-ui-only`, `no-browser-dialog`,
`no-swallowed-error`, `send-via-notify`, `emit-notify-in-actions`, `no-next-safe-action`,
`app-time-zone-dates`, `file-size`, `track-new-tables`, `migrations-are-final`) and
`pnpm actions:tests` checks that every action is tested ([docs/ai-workflow.md](docs/ai-workflow.md)).
A failure message says how to fix it. Fix the cause; `// rules-ok: <rule> — <reason>` is only for
cases a reviewer would agree with.

## Common mistakes (add to this when an AI gets something wrong)

- Icons → Phosphor only, imported from `@app/ui/components/icons` (`PlusIcon` …), never from
  `@phosphor-icons/react` directly and never another icon library. Missing one? Add it to that
  file's export list. Light weight is the default; the active/selected state passes `weight="fill"`.
- Tabs → `Tabs` / `TabbedPanels` (`@app/ui/components/tabs`); URL-driven tabs → `FilterLinks`.
  Never hand-build a tab row or a filter-chip row for real tabs.
- Building a coloured notice box by hand → use `<Callout>` (`@app/ui/components/callout`).
- `window.confirm` / `prompt` / `alert` → `await confirm({ title, confirmLabel })` / `prompt()` /
  `alert()` from `@app/ui/components/alert-dialog`. A record page's fields → `<EditableCard>`, not
  an open form.
- `<DropdownMenuLabel>` loose in a menu → wrap it and its items in `<DropdownMenuGroup>`; Base UI
  crashes the page otherwise.
- A hand-written form with its own server action and `useState` error handling → `<ActionForm
action="area.verb">` (docs/actions.md).
- `.catch(() => {})` / `catch {}` with no reason → report it, or say in a comment why it's expected.
- `<Field label error>` with a hand-set `htmlFor` + `id` on its `<Input>` loses the label link in the browser once the field is invalid (axe: "form elements must have labels"). Leave both out; `Field` pairs them.
- Putting a new action in a big `index.ts` → one file per action or group, re-exported.
- Forgetting `pnpm actions:docs` → CI fails on stale generated files.
- Editing a migration that's already on `main` → write a new one.
- Testing only the happy path of a mutation that has rules (who may, which states) → test the
  refusals too.
- A row that's wider than a phone (a flex row without `min-w-0`/`flex-wrap`, a fixed `w-48` label)
  → the whole page scrolls sideways. Check at 320px (docs/design-system.md rule 12).
- `getDb()` inside a transaction (an action's `run`, a helper it calls) → use the `tx` you were
  given. Each server has a small connection pool, so it can wait forever and every request on that
  server hangs. `getDb()` throws there in tests and `pnpm dev`.
- A slow outside call (email, payments, AI) inside an action holds its database connection the
  whole time → keep such calls few and time-limited, queue a job, and let a read degrade (show "—")
  rather than wait.
- Dates: store UTC, format in the app's time zone (`APP_TIME_ZONE`, default `America/Chicago`) with
  `formatDate` / `formatDateTime` from `@app/ui/lib/dates`, never `toLocaleDateString()` on the server.
- Dark mode: tinted surfaces lighten, they don't invert (docs/design-system.md → dark-mode rule).

## Stack

Next.js 16 (App Router, `proxy.ts` not middleware) · React 19 · TypeScript · Tailwind CSS 4 ·
Base UI + shadcn-style components · Phosphor icons · Drizzle ORM + postgres.js · Postgres (Neon or
Supabase) · Zod 4 · Vitest · pnpm + Turborepo. Cloud sessions: the session-start hook installs
everything and starts a local Postgres 16 with `DATABASE_URL` set, so `pnpm check` works. Next.js
changed a lot — read `apps/web/node_modules/next/dist/docs/` before using a Next API you are unsure of.

## Repo map

```
apps/web/                 Next.js app (all surfaces + API + MCP)
  app/(site)/             public website
  app/(auth)/             /login /verify
  app/account/            customer portal
  app/admin/              admin app
  app/brand/              design system showcase
  app/api/v1/actions/     REST API over actions
  app/api/mcp/            MCP server over actions
  lib/auth/               AuthAdapter: types.ts, index.ts, neon.ts, supabase.ts (BACKEND=…)
  lib/viewer.ts           who is signed in → contact + roles (requireViewer)
  lib/invoke.ts           server action that runs any action for the signed-in user
  lib/use-action.ts       client hook around invokeAction (toasts + refresh)
  components/forms/       ActionForm, FormDialog, DeleteForm
  proxy.ts                session refresh + login redirect
packages/core/            business logic: defineAction, actions, permissions, errors, events, notifications, jobs, files
packages/db/              Drizzle schema (app schema), migrations, seed, db client
packages/ui/              design tokens (globals.css) + components
docs/                     developer docs (README.md is the index; *.generated.md is generated)
scripts/check-rules.mjs   the rules above as a check (pnpm rules)
.claude/                  skills, hooks (session setup, guard, auto-format), settings
```

## Commands

```bash
pnpm dev                 # run the app at localhost:3000
pnpm check               # everything CI runs — run before every push
pnpm rules               # the rules above, checked mechanically
pnpm format:fix          # auto-format
pnpm db:generate         # create a migration after editing packages/db/src/schema
pnpm db:migrate          # apply migrations to DATABASE_URL (local only in sessions)
pnpm db:seed             # fake data (refuses production)
pnpm actions:docs        # regenerate docs/actions.generated.md
pnpm test                # tests (need DATABASE_URL → local Postgres; see docs/testing.md)
pnpm actions:tests       # every action has a "works" + "refused" test (after pnpm test)
```

## Git & environments

- `main` = production. Work on a feature branch → PR → CI green → merge. Never push straight to
  `main`, never force-push it. If you add a `dev` branch (test site), the flow is branch → `dev` →
  test there → `main`; migrations run on deploy, never by hand on a hosted database.
- Env vars: `.env.example` lists every one; add new ones there and to TODO.md (owner section).
