# Boilerplate build plan (contract for everyone building this repo)

Goal: a copy-and-own starter. The owner copies these files into a NEW repo and renames/rewrites freely.
So: no forks, no published packages, everything readable, every optional module deletable as one folder.
Source of truth for ported code: /home/user/RentSomethingKCv2 (read-only reference; copy then strip RSKC specifics:
Cardinal Orange, rentals/orders/inventory/dunning/phone/parts/Stripe/Telnyx/Google, Central-time rules, `rskc_`/`RSKC_` names,
Spanish docs, rskc.dev hosts). Generic mechanics stay.

## Shape

pnpm + Turborepo monorepo, scope `@app/*` (owner renames with find/replace).

- `apps/web` Next.js 16 (App Router, `proxy.ts`), React 19, Tailwind 4. Surfaces: public site + auth (`/`, `/login`), customer portal `/account`, admin `/admin`, `/brand` (living style guide), `/docs`, `/api/v1/actions` (REST), `/api/mcp`.
- `packages/ui` shadcn-style components on Base UI + Phosphor (ported from v2 packages/ui). Tokens in `src/styles/globals.css` (oklch, `light-dark()`, `.dark`). One brand ramp `--brand-50..900` (neutral default: indigo-ish), `--primary` = brand-500.
- `packages/db` Drizzle ORM + postgres.js over plain `DATABASE_URL`. Everything in Postgres schema `app`, RLS on, no grants to anon/authenticated. Provider-neutral.
- `packages/core` ALL business logic: `defineAction` framework, permissions, activity/change log, errors, events, notifications, jobs. apps/web never touches the DB.

## Dual backend (Neon OR Supabase) — the one rule

Data goes ONLY through Drizzle over `DATABASE_URL` (never PostgREST / Data API / supabase-js for data). Authorization lives in actions; RLS-on-no-grants is a backstop.
Only three things differ per provider, each behind a small interface and selected by `BACKEND=neon|supabase`:

1. Auth: `apps/web/lib/auth/{types.ts,index.ts,neon.ts,supabase.ts}` — `AuthAdapter { getSession(); sendEmailCode(email); verifyEmailCode(email, code); signOut() }` (email code / magic link only). Links to `app.contacts.auth_user_id` (TEXT, so it fits both uuid and Better-Auth ids).
2. Storage: S3-compatible presign/put in `packages/core/src/files/s3.ts` (env `S3_*`); both providers expose S3.
3. Migrations that mention a provider's auth schema: none in shared migrations. Keep provider-specific SQL in `packages/db/migrations-provider/{neon,supabase}/` only if truly needed.
   Removing a provider = delete its adapter file + its env block + `BACKEND` branch. Document in docs/choosing-a-backend.md.

## Actions + forms (the simplest best approach — NO next-safe-action)

- `defineAction({name:'area.verb', title, description, audience, input: zod, mutates, run({input, actor, tx, log})})` in `packages/core/src/actions/<area>/`. One file per action or group, re-exported.
- Result: `{ok:true,data} | {ok:false,error:{code,message,ref?,fieldErrors?}}`. Expected failures = `ActionError`; unexpected -> `reportError()` -> `E-XXXXXXXX` ref.
- `apps/web/lib/invoke.ts` single server action `invokeAction(name,input)`; `lib/use-action.ts` hook; `components/forms/action-form.tsx` `<ActionForm action="x.y" ...>` (useActionState, FormData -> zod input, per-field errors, toast, refresh, closes enclosing dialog, shows E-ref + copy on failure); `form-dialog.tsx` (Add/Edit in page actions), `delete-form.tsx` (confirm first). A new screen = one defineAction + one <ActionForm>.
- REST (`/api/v1/actions/[name]`, bearer API key, Idempotency-Key) and MCP (`/api/mcp`) are generic routes over the registry. Optional module.

## Logging / errors (first-class)

- `app.track_changes(tbl, subject_col, VARIADIC skip)` trigger -> `app.change_log` (field-level before/after) linked by `app.activity_id` to `app.activity_log` (who/channel/input redacted/ok/error_ref). Test fails if any app table is untracked.
- `error_events` + `reportError()` + `diagnose()` + fingerprint/spike alerts + client capture (`instrumentation-client.ts`, `/api/errors`) + `error.tsx`/`global-error.tsx` + per-area error screens + Admin -> Errors with "Copy for AI agent" brief + `fix-error` skill.
- Also `cron_runs` + `/api/healthcheck` (integration status) from ClassifiedCases.

## Conventions (enforced by scripts/check-rules.mjs)

No raw colours (tokens only); icons only from `@app/ui/components/icons` (Phosphor); no db in apps/web; no window.confirm/alert; no swallowed errors; every app table tracked; migrations final; files <= 750 lines; emit()/notify() only inside actions. Dates: store UTC, format in the app's configured time zone (`APP_TIME_ZONE`, default America/Chicago) via `packages/ui/src/lib/dates.ts`.

## Phases

P1 (parallel): ui | db+core foundation | tooling (rules checker, hooks, skills, CI, AGENTS.md).
P2 (parallel): web (auth adapters, shells, portal, admin, brand, error screens, forms) | modules (events+automations, notifications, REST+MCP, docs+i18n).
P3: verification (typecheck, rules, tests, run the app), docs, polish.

Every worker: only touch your own directories; run `pnpm install` at repo root only if package.json files changed and no one else is mid-install (prefer `pnpm install --filter <yourpkg>...`); make `pnpm --filter <yourpkg> typecheck` pass; report exact exported API of what you built so dependents can use it.
