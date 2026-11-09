---
name: new-project-from-boilerplate
description: Turn a fresh copy of this boilerplate into a real project — rename @app, pick Neon or Supabase, set the brand colour, delete the modules you don't need. Use when the owner says "start a new project from this boilerplate", "rename the app", "pick a backend" or "remove the automations module".
---

# New project from the boilerplate

The boilerplate is copy-and-own: the owner copied the files into a NEW repo and may rewrite
anything. Walk through the steps below **one at a time, asking before each destructive step**, and
run `pnpm check` after each section. Keep a running list in TODO.md of what is done.

## 0. Ask first

Collect: the project name (display + slug), the npm scope they want instead of `@app`
(e.g. `@acme`), the backend (Neon or Supabase — see docs/choosing-a-backend.md), the production
domain, the brand colour (or "keep the default"), the owner's email, and which modules to keep
(below). Write the answers at the top of TODO.md.

## 1. Run the script (rename, backend, modules)

`scripts/new-project.mjs` does steps 1, 2 and 4 in one go and is safe to run twice. Always look at the
dry run first, then run it for real on a branch (`git status` clean, `git switch -c chore/new-project`):

```bash
node scripts/new-project.mjs --name "Acme Rentals" --scope @acme --backend supabase \
  --modules automations,docs --dry-run
node scripts/new-project.mjs --name "Acme Rentals" --scope @acme --backend supabase \
  --modules automations,docs
node scripts/new-project.mjs --modules list     # what can be removed
```

- **Scope + names**: `@app` → your scope in every file (package names, imports, docs, skills, the rules
  script's `CONFIG`), the display name in `apps/web/lib/site.ts`, the logo, `.env.example`, README title, the
  root package name and the local database name. Your own prose in the docs is yours to rewrite (step 5).
- **Backend** (`--backend neon|supabase` = the one to KEEP): deletes the other adapter and its test, the
  `app/api/auth` proxy (Neon), its dependency, env block and `turbo.json` pattern, and makes
  `lib/auth/index.ts` return the remaining adapter. Data code is untouched (Drizzle over `DATABASE_URL`).
- **Modules** (`--modules a,b` = the ones to REMOVE): deletes folders, registrations (`modules.ts`),
  nav and site links, package exports, scripts, CI steps and every `emit(tx, …)` call of the events
  module. Whatever still uses a removed module (a clean-up step, a search source, a test) is printed as
  **Needs you**: fix each one by hand. With `automations` removed it also runs `pnpm db:generate` to
  write a NEW migration that drops its tables (review it; never edit an applied migration).
- It runs Prettier and `pnpm install`, adds a checklist to TODO.md, and never commits.

Then `pnpm check`. Anything that fails is either a "Needs you" item or a real bug in the script: fix
the manifest in `scripts/new-project.mjs` (and its test, `pnpm test:scripts`).

The sections below say what the script does, for a manual run or a part it does not cover.

## 1a. Rename `@app` by hand (only if the script cannot run)

1. `git status` must be clean. Make a branch `chore/rename`.
2. Replace the scope everywhere, including docs, skills and the rules script:
   `grep -rl '@app/' . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next | xargs sed -i 's#@app/#@acme/#g'`
   Also: root `package.json` `name`, each `packages/*/package.json` and `apps/*/package.json`
   `name`, the `CONFIG.scope` and `CONFIG.dates.helper` in `scripts/check-rules.mjs`, workflow
   `--filter` lines, `tsconfig` path aliases, `transpilePackages` in `apps/web/next.config.ts`.
3. Replace the display name ("App") in the logo, `<title>`/metadata, email templates, the
   `/brand` page, README.md and AGENTS.md. Replace `localhost:5432/app` database names if wanted.
4. `rm -rf node_modules pnpm-lock.yaml && pnpm install`, then `pnpm check`.

## 2. Pick a backend

Follow docs/choosing-a-backend.md "Removing a provider" (the script's `--backend` does it). Then walk
the owner through creating the database and auth project (docs/choosing-a-backend.md → Provider setup;
what only they can do goes in TODO.md under "Owner"). Run `pnpm db:migrate` against a LOCAL database only.

## 3. Brand

One token: `--brand-50 … --brand-900` in `packages/ui/src/styles/globals.css`; `--primary` is
`brand-500`. Replace the ramp (docs/design-system.md → Brand by one token), check light and dark,
replace logo artwork in `apps/web/public/brand/` and the favicon. No raw colours in `apps/web`.

## 4. Delete unused modules

`--modules` does this (see above). By hand: each module is one folder plus its registrations
(docs/architecture.md → Modules): delete its folder(s), remove its re-export/registration, its
migration tables only if nothing was ever applied (otherwise leave the tables, add a NEW migration to
drop them), its env vars, its docs page and its entry in docs/README.md. Then
`pnpm typecheck && pnpm rules && pnpm test`. Never leave a half-removed module.

## 5. Make the docs yours

Rewrite README.md, the "Rules" intro in AGENTS.md (keep the numbered rules), docs/decisions.md
(start a fresh log with today's decisions: name, backend, modules kept), and the domain-specific
sections of docs/architecture.md. Remove this skill's "new project" TODO items when done.

## 6. First sign-in

Set `OWNER_EMAILS`, run the app, sign in with an emailed code, and confirm the first owner got the
owner role (docs/architecture.md → Auth). Finish with skill `finish-change`.
