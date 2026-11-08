# Architecture

```
            Browser / installed app / AI assistant
                │                │                    │
        pages (RSC + client)   /api/v1/actions       /api/mcp
                │                │                    │
                └──────► @app/core actions ◄──────────┘
                          │  (check permission → validate → run in a
                          │   transaction → write activity log; triggers
                          │   record field changes; bugs → error report)
                          ▼
                @app/db (Drizzle + postgres.js, server-only, plain DATABASE_URL)
                          │
                          ▼
                 Postgres (Neon or Supabase — same code)
                   └─ app.*   our tables (RLS on, no grants to anon/authenticated)
```

## Pieces

- **apps/web** — the only deployable. Next.js 16 on Vercel (or any Node host). Surfaces: the public
  site and sign-in (`/`, `/login`), the customer portal `/account`, the admin `/admin`, `/brand`,
  `/docs`, the REST API and the MCP server. Pages never hold business rules; they call actions.
  `apps/web` never imports the db package (`pnpm rules`: `no-db-in-web`).
- **packages/core** — all business logic: `defineAction` and `runAction`, `actions/<area>/`,
  `access/` (permissions, roles, actors), `identity.ts` (login → contact), `errors/`, `events/`,
  `notifications/`, `messaging/` (email/SMS with the test guard), `jobs/`, `files/`
  (S3-compatible), `api-keys.ts`, `env.ts`.
- **packages/db** — Drizzle schema for the `app` schema, migrations, seed, the db client
  (postgres.js). Provider-neutral.
- **packages/ui** — design tokens (`src/styles/globals.css`) and components on Base UI with
  Phosphor icons ([design-system.md](design-system.md)).

## Dual backend

Data goes ONLY through Drizzle over `DATABASE_URL`: never PostgREST, the Neon Data API or
supabase-js for data. Authorization lives in actions; RLS-on-with-no-grants is a backstop in case a
key leaks. Only two things differ per provider, selected by `BACKEND=neon|supabase`:

1. **Auth** — `apps/web/lib/auth/{types,index,neon,supabase}.ts`, an `AuthAdapter` with
   `getSession()`, `sendEmailCode(email)`, `verifyEmailCode(email, code)`, `signOut()`. The login
   links to `app.contacts.auth_user_id` (TEXT).
2. **Storage** — S3-compatible presign/put in `packages/core/src/files/s3.ts` (env `S3_*`).

Shared migrations never mention a provider's auth schema; provider-specific SQL, if truly needed,
lives in `packages/db/migrations-provider/{neon,supabase}/`. See
[choosing-a-backend.md](choosing-a-backend.md).

## Request flow (admin creates a contact)

1. `/admin/contacts/new` renders `<ActionForm action="contacts.create">`.
2. Submit → `invokeAction('contacts.create', input)` (the one server action in `lib/invoke.ts`).
3. `invokeAction` builds the **actor** from the session (`lib/viewer.ts`) and calls `runAction`.
4. `runAction` checks the actor has `contacts.write`, validates input with zod, runs the action
   inside a database transaction and writes `app.activity_log` (IP, browser, request id). A Postgres
   trigger writes each changed row's before → after values to `app.change_log`. If the action hits
   a bug, it is saved to `app.error_events` and the person gets an error reference — see
   [logging.md](logging.md) and [errors.md](errors.md).
5. The form shows a toast, refreshes, and closes its dialog; server components re-read via
   `callAction(listContacts, …)`.

REST and MCP do steps 3–4 with an API-key actor instead of a session.

## Auth

Passwordless: an emailed code (or magic link) is the only sign-in method. `proxy.ts` refreshes the
session cookie and redirects signed-out visitors away from `/account` and `/admin`.
`lib/viewer.ts` asks the `AuthAdapter` who the user is and maps them to their contact and roles;
each surface's layout calls `requireViewer(permission)`. The first sign-in with an address in
`OWNER_EMAILS` gets the owner role. Tags describe, roles grant: a tag never unlocks anything.

## Events, notifications, jobs

- **Events** — `emit(tx, 'type', data)` inside an action writes to an outbox table in the same
  transaction; the job queue hands each to the automations listening, once.
- **Notifications** — `notify(tx, 'type', …)` writes the inbox item and one delivery per channel
  (email, SMS, push); a dispatcher sends after the response and from cron, with retries. SMS needs
  recorded consent. Low-level `sendEmail`/`sendSms` are only used inside
  `packages/core/src/notifications`.
- **Jobs** — `enqueue(tx, 'type', payload)` for work after commit, later, or with retries.
- `cron_runs` records scheduled-job runs; `/api/healthcheck` reports integration status.

## Modules (each deletable as one folder plus its registration)

| Module               | Folders                                                                   | Delete when                  |
| -------------------- | ------------------------------------------------------------------------- | ---------------------------- |
| REST + MCP           | `apps/web/app/api/v1/actions`, `apps/web/app/api/mcp`, `api-keys.ts`      | no outside callers or AI     |
| Events + automations | `packages/core/src/{events,automations}`, their tables                    | nothing reacts to events     |
| Notifications        | `packages/core/src/{notifications,messaging}`, bell/settings UI           | you never message people     |
| Docs + i18n          | `apps/web/app/docs`, `content/`, translation files                        | no in-app help, one language |
| Brand page           | `apps/web/app/brand` (keep it while you build UI)                         | late, once the UI is done    |
| Jobs                 | `packages/core/src/jobs`, `/api/cron/*` (events and notifications use it) | only with those two          |

Remove a module in this order: its UI and routes, its registrations (action catalog, event catalog,
notification registry), its env vars, its docs row, then run `pnpm typecheck && pnpm rules && pnpm test`.

## Why a monorepo

`apps/web` today; native shells or other apps later share `packages/ui` and talk to the same
actions.
