# Decisions log

Append newest at the bottom. Format: date — decision — why. Don't re-decide something listed here
without the owner. In a new project, start a fresh log (skill `new-project-from-boilerplate`).

- 2026-11-08 — Copy-and-own starter, not a library: no forks, no published packages, everything readable, every optional module deletable as one folder. — The owner renames and rewrites freely; nothing to keep in sync.
- 2026-11-08 — pnpm + Turborepo monorepo, scope `@app/*` (find/replace to rename). — One app today, room for more apps sharing `ui`, `db` and `core`.
- 2026-11-08 — All business logic is `defineAction` in `packages/core`; UI, REST and MCP are generated from the registry; `apps/web` never touches the database. — One rule set for UI, API and AI; self-documenting.
- 2026-11-08 — No `next-safe-action`. A form is `<ActionForm action="area.verb">` over a single `invokeAction` server action. — One mechanism instead of two; a new screen is one action plus one form; errors and refs behave the same everywhere.
- 2026-11-08 — Data only through Drizzle over `DATABASE_URL`; never Supabase JS, the Neon Data API or PostgREST for data. — Authorization lives in actions; the code is identical on Neon and Supabase.
- 2026-11-08 — Dual backend selected by `BACKEND=neon|supabase`; only auth and file storage differ, each behind a small interface. `auth_user_id` is TEXT. — Provider is a one-afternoon choice; removing one is deleting an adapter and an env block.
- 2026-11-08 — Our tables in schema `app`, RLS on, no grants to `anon`/`authenticated`. — A leaked browser key reaches nothing.
- 2026-11-08 — One contacts table for every person; tags describe, roles grant; permissions are defined in code, roles stored in the DB. — Staff can be customers; access changes are deliberate and audited; permission changes are reviewed in PRs.
- 2026-11-08 — Activity log + field-level change log via a Postgres trigger on every `app` table, linked by `activity_id`. — Catches every write, including ones outside the app; no per-action diff code to forget.
- 2026-11-08 — Errors get a per-occurrence reference (`E-…`) + diagnosis code + fingerprint, stored in `app.error_events`, with an "AI brief" and a `fix-error` skill. — A static code names a category, not a cause; the reference lets an AI fetch the full context.
- 2026-11-08 — Rules in AGENTS.md are enforced mechanically by `scripts/check-rules.mjs` (configurable via its `CONFIG`). — A failing check is followed every time; written rules only most of the time.
- 2026-11-08 — One brand ramp (`--brand-50..900`) with `--primary` = brand-500; neutral indigo default; dark mode lightens surfaces rather than inverting. — Rebranding is one token change.
- 2026-11-08 — Phosphor icons only, via `@app/ui/components/icons`. — One icon set, one place to add one, checked by `icons-from-ui-only`.
- 2026-11-08 — Dates are stored UTC and formatted in `APP_TIME_ZONE` (default `America/Chicago`) through `@app/ui/lib/dates`. — Servers run in UTC; evening times must not show as the next day.
- 2026-11-08 — Money is always integer cents. — No floating-point rounding bugs.
