---
name: add-migration
description: Change the database schema — add or change a table, column, index or enum in the `app` schema. Use whenever a feature needs to store something new or store it differently.
---

# Changing the database schema

Rules (AGENTS.md 5 and 10): our tables live in the `app` schema with RLS on and no grants to
`anon`/`authenticated`; every schema change is a Drizzle migration; an applied migration is never
edited; a new table records its changes. `pnpm rules` and `pnpm test` enforce this. The same
migrations run on Neon and Supabase — don't reference either provider's `auth` schema in them.

1. **Edit the schema** in `packages/db/src/schema/<area>.ts` (export it from `schema/index.ts`
   if the file is new). Follow an existing table:
   ```ts
   export const projects = app
     .table('projects', {
       id: id(),
       contactId: uuid('contact_id')
         .notNull()
         .references(() => contacts.id),
       budgetCents: integer('budget_cents').notNull(), // money is always integer cents
       createdAt: createdAt(),
       updatedAt: updatedAt(),
     })
     .enableRLS();
   ```
   `app.table(…)` — never `pgTable` (that is the public schema). Always `.enableRLS()`.
2. **Generate the migration:** `pnpm db:generate` (needs `DATABASE_URL` → local Postgres; the
   session-start hook sets it in cloud sessions). Name it:
   `pnpm --filter @app/db exec drizzle-kit generate --name <what_changed>`.
   Read the SQL it wrote in `packages/db/migrations/` — a rename shows up as drop + add, which
   loses data; write the rename by hand in a custom migration instead.
3. **New table? Track it** in a custom migration right after:
   ```bash
   pnpm --filter @app/db exec drizzle-kit generate --custom --name <table>_tracking
   ```
   ```sql
   SELECT app.track_changes('app.projects', 'contact_id');          -- history shows on the contact
   SELECT app.track_changes('app.things', 'id', 'secret_col');      -- never copy secret_col
   ```
   The second argument names the record the history belongs to. Only logs/queues are untracked —
   they are listed with reasons in `scripts/check-rules.mjs` (`UNTRACKED_TABLES`).
4. **Apply locally:** `pnpm db:migrate`, then `pnpm test`. Add the table to the reset list in
   `packages/core/test/setup.ts` if tests write to it.
5. **Reads/writes go through actions** (skill `add-action`).
6. **Seed data:** if screens need it to look real, add rows to `packages/db/scripts/seed.ts`.
7. `pnpm check`. Hosted databases are migrated by the deploy — never run `db:migrate` against
   them yourself (the guard hook blocks it).

## Never

- Edit, rename or delete a migration that is on `main` — the databases already ran it. Made a
  mistake? Write a new migration that fixes it.
- Hand-edit `packages/db/migrations/meta/*` — drizzle-kit owns it.
- Create tables in `public`, grant anything to `anon`/`authenticated`, or use a provider client
  (Supabase JS, Neon Data API) for data.
