# Boilerplate

A copy-and-own starter for a digital-first business app. One Next.js 16 app gives you a public
site with passwordless sign-in, a customer portal (`/account`), an admin (`/admin`), a living
style guide (`/brand`), help docs (`/docs`), a REST API (`/api/v1/actions`) and an MCP server
(`/api/mcp`) — all over **one set of business actions**, with an activity log, field-level change
history and error references with an "AI brief" built in.

It is built to be changed by AI: small files, written rules, and checks that fail when a rule is
broken (`pnpm rules`).

## Copy-and-own workflow

No fork, no published packages. Copy this repo's files into a NEW repository and make it yours:

1. Copy the files (not `.git`) into your new repo and commit them as the first commit.
2. Open it in Claude Code and say: **"Start a new project from the boilerplate."** The skill
   `new-project-from-boilerplate` runs `scripts/new-project.mjs` (renames `@app/*`, keeps one provider, removes modules; `--dry-run` first), helps you pick Neon or Supabase, sets your brand
   colour and deletes the modules you do not need.
3. Build features with the other skills (`add-action`, `add-migration`, `add-screen`,
   `add-notification`), and `finish-change` before every commit.

Every optional module is one folder you can delete (docs/architecture.md → Modules).

## Quick start

Requires Node 22+, pnpm 10, and a local Postgres 16.

```bash
cp .env.example .env            # BACKEND=neon (or supabase), DATABASE_URL=postgres://…@localhost:5432/app
pnpm install
createdb app && pnpm db:migrate && pnpm db:seed
pnpm dev                        # http://localhost:3000
pnpm check                      # typecheck, lint, rules, format, docs, tests — run before every push
pnpm e2e                        # browser tests (Playwright) on a throw-away database; starts a local S3 stand-in too
docker compose up -d --build    # or: Postgres + the production image (docs/deploy.md)
```

In a Claude Code cloud session the hooks in `.claude/` do the install and start Postgres for you.

## Shape

```
apps/web      Next.js app: site, /account, /admin, /brand, /docs, REST + MCP
packages/ui   components (Base UI, shadcn-style) + tokens; one brand colour ramp
packages/db   Drizzle ORM over DATABASE_URL, schema `app`, migrations, seed
packages/core ALL business logic: actions, permissions, logging, errors, events, notifications, jobs
```

`apps/web` never touches the database; it calls actions.

## What is in the box

Sign-in by emailed code, roles and permissions, users with tags, CSV import/export and bulk actions,
activity log with before/after history, error references with an AI brief, notifications (inbox, email,
SMS with consent, push), automations, file uploads and avatars, data export and account deletion, feature
flags, settings, a contact form and newsletter with double opt-in, command palette search, dark mode and
Spanish. Files without a bucket: `node scripts/dev-s3.mjs` ([docs/files.md](docs/files.md)).

## Dual backend (Neon or Supabase)

Data goes only through Drizzle over `DATABASE_URL`, so any Postgres works. Only auth (email code /
magic link) and file storage differ per provider, each behind a small interface selected by
`BACKEND=neon|supabase`. Commit to one and delete the other's adapter and env block. See
[docs/choosing-a-backend.md](docs/choosing-a-backend.md).

## Docs

Start at [docs/README.md](docs/README.md). Rules for AI and people: [AGENTS.md](AGENTS.md). Open
work: [TODO.md](TODO.md).
