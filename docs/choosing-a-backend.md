# Choosing a backend — Neon or Supabase

The boilerplate runs on either. You pick one when you start a project and delete the other.

## The one rule

Data goes ONLY through Drizzle over `DATABASE_URL` (postgres.js), inside actions. Never PostgREST,
the Neon Data API or supabase-js for data (`pnpm rules`: `no-provider-client-for-data`). Because of
that, the database layer is plain Postgres and identical on both. Authorization lives in actions;
every table has RLS on with no grants to `anon`/`authenticated` so a leaked browser key reaches nothing.

## What differs (and only this)

| Concern           | Where                                                                          | Neon                                            | Supabase                                                    |
| ----------------- | ------------------------------------------------------------------------------ | ----------------------------------------------- | ----------------------------------------------------------- |
| Sign-in           | `apps/web/lib/auth/{types,index,neon,supabase}.ts`, `AuthAdapter`              | Neon Auth (Better Auth) email code              | Supabase Auth email OTP / magic link                        |
| File storage      | `packages/core/src/files/s3.ts`, env `S3_*`                                    | Neon Object Storage (S3)                        | Supabase Storage S3 endpoint                                |
| Provider-only SQL | `packages/db/migrations-provider/{neon,supabase}/` (empty unless truly needed) | —                                               | —                                                           |
| Env               | `.env.example`                                                                 | `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

```ts
interface AuthAdapter {
  getSession(): Promise<{ userId: string; email: string } | null>;
  sendEmailCode(email: string): Promise<void>;
  verifyEmailCode(email: string, code: string): Promise<{ userId: string; email: string }>;
  signOut(): Promise<void>;
}
```

`getAuthAdapter()` in `lib/auth/index.ts` returns the adapter for `BACKEND`. The login links to
`app.contacts.auth_user_id`, a **TEXT** column, so it holds a Supabase uuid or a Better-Auth id.
`lib/viewer.ts`, `proxy.ts` and the login pages depend only on the interface.

## Picking

- **Neon** — serverless Postgres with branching (a test site gets its own copy of data and logins),
  scale to zero, managed Better Auth, S3-compatible object storage. Good when cost at low traffic and
  branching matter.
- **Supabase** — Postgres + Auth + Storage in one dashboard, mature tooling, email templates and
  rate limits for sign-in built in. Good when you want one familiar all-in-one console.

If unsure, choose Neon for a new small project, Supabase if you already use it. The choice costs
one afternoon to reverse because nothing else depends on it.

## Removing a provider

1. Delete its adapter file (`lib/auth/neon.ts` or `supabase.ts`) and its branch in `lib/auth/index.ts`
   (or make `index.ts` export the remaining adapter directly).
2. Delete its env block from `.env.example` and its package dependencies from `apps/web/package.json`;
   remove `BACKEND` if you like (or keep it fixed to your provider).
3. Delete `packages/db/migrations-provider/<provider>/` if present.
4. Edit the `CONFIG.authAdapterPaths` in `scripts/check-rules.mjs` only if you moved the adapter.
5. `pnpm install && pnpm check`.

The migrations in `packages/db/migrations/` are shared and untouched; the data stays valid.

## Local development

Both backends use the same local Postgres 16 (`postgres://postgres:postgres@localhost:5432/app`) for
tests and `pnpm dev` data. Sign-in in local development needs the provider's project (or a dev
bypass the web agent documents in `apps/web/lib/auth/`).
