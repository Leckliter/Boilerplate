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

## Provider setup (what only you can do, step by step)

Do this once per environment (production, test site; previews use branches, docs/deploy.md). Dashboard
wording changes: if a label differs, look for the same idea.

### Neon (`BACKEND=neon`)

1. **neon.com → Create project** (pick the region next to your Vercel region). Copy the **pooled**
   connection string into `DATABASE_URL` and the **direct** one (host without `-pooler`) into
   `DATABASE_URL_DIRECT`.
2. Project → **Auth → Enable Auth** (Managed Better Auth). Copy the **Auth URL** into
   `NEON_AUTH_BASE_URL`. Generate `NEON_AUTH_COOKIE_SECRET` yourself: `openssl rand -base64 48` (32+
   characters; it signs the session cookie, keep it secret and stable: changing it signs everyone out).
3. **Auth → Configuration → Trusted domains**: add every ORIGIN the app runs on, with the protocol and no
   trailing slash: `https://app.example.com`, `https://test.example.com`, and `http://localhost:3000` for
   local work (or the CLI: `neon neon-auth domain add https://app.example.com`). Neon only redirects to
   trusted domains, so a missing one breaks sign-in redirects and email links.
4. **Auth → Plugins / Sign-in methods**: turn **Email OTP** on (the app sends `type: 'sign-in'` codes). You
   may leave password sign-in off: the app never offers it.
5. **Auth → Email**: the shared Neon sender works for testing; for production set your own SMTP sender /
   domain so codes are not marked as spam. Template text: keep the code in the subject or first line
   ("Your sign-in code is {{otp}}"); the app asks for the 6 digits, there is no link to click.
6. **Object Storage**: create a bucket; put its S3 endpoint, region, bucket and an access key pair in `S3_*`.
7. Vercel: set the variables, deploy, open `/api/healthcheck` and sign in with an owner email.

The browser talks to Neon Auth only through the app's `/api/auth/*` route (`app/api/auth/[...path]`),
which proxies and signs the session cookie; Neon sees the app's `Origin` header, which is why the origin
must be trusted.

### Supabase (`BACKEND=supabase`)

1. **supabase.com → New project**. **Project Settings → Database → Connection string**: use the
   _Transaction pooler_ string for `DATABASE_URL` and the _Direct / Session_ string for
   `DATABASE_URL_DIRECT`.
2. **Project Settings → API**: copy the project URL into `NEXT_PUBLIC_SUPABASE_URL` and the `anon`/publishable
   key into `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Never put the `service_role` key anywhere in this app: it
   is not used (data goes over `DATABASE_URL`).
3. **Authentication → Providers → Email**: enable it; turn **Confirm email** on; leave "Enable email
   signups" on (first sign-in creates the login; the contact is linked by email).
4. **Authentication → URL Configuration**: **Site URL** = the environment's URL (`https://app.example.com`).
   **Redirect URLs**: add `https://app.example.com/auth/confirm`, the test site's, and
   `http://localhost:3000/auth/confirm`.
5. **Authentication → Emails → Templates** (Magic Link; also Confirm signup, which a first sign-in uses):
   put the code and a link in the same email.

   ```html
   <h2>Your sign-in code</h2>
   <p>Enter this code: <strong>{{ .Token }}</strong></p>
   <p>
     Or
     <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email"
       >sign in with one click</a
     >.
   </p>
   ```

   `{{ .Token }}` is the 6-digit code the login form asks for (`verifyEmailCode`); the link lands on
   `/auth/confirm` (`confirmLink`). In both templates use `type=email`.

6. **Authentication → Rate Limits**: the default (a few emails per hour on the built-in sender) is only
   for testing. Configure **custom SMTP** (Resend works) before launch, then raise the limits.
7. **Storage**: create a bucket; **Project Settings → Storage → S3 connection** gives the endpoint, region and
   access keys for `S3_*` (`S3_FORCE_PATH_STYLE=true`).

### Both

- Set `OWNER_EMAILS`; the first sign-in with that email becomes the owner (docs/architecture.md → Auth).
- `DEV_LOGIN=1` is for local development and the e2e suite only; it is ignored by production builds.

## How the adapters were checked

Written against the installed SDKs (`@neondatabase/auth` 0.7 beta, `@supabase/ssr` 0.12), reviewed in
`apps/web/lib/auth/{neon,supabase}.ts`, with unit tests that mock each SDK (`neon.test.ts`,
`supabase.test.ts`: `pnpm --filter web test`). What was verified and fixed:

- **Next 16 `cookies()` is async**: both adapters `await` it; Supabase's `setAll` swallows the
  "cannot set cookies in a Server Component" error on purpose (the proxy refreshes the session instead).
- **Session refresh in `proxy.ts`**: Supabase refreshes through `getClaims()` and copies the new cookies and
  the `Cache-Control` headers onto the response, skipping the call entirely when there is no `sb-` cookie.
  Neon's middleware is run and its redirect to `/login` is _read_ (not followed); the redirect's
  `Set-Cookie` headers (which clear a stale cookie) are now kept, the match is on the redirect's path
  (not a substring), and `/login` itself (which Neon never checks) answers from the session cookie.
- **Code verification**: a 4xx from the provider is "that code is wrong or expired"; a 5xx / network
  failure is **not** shown as a wrong code any more: it is thrown, reported, and the person gets an `E-…`
  reference.
- **Sign-out**: Supabase `signOut()` defaults to scope `global` (every device); the adapter now uses
  `{ scope: 'local' }`. Neon's server `signOut` clears the session and session-data cookies.
- `getUser()` (Supabase) and the Neon session lookup ask the provider; a cookie alone is never trusted.

## Local development

Both backends use the same local Postgres 16 (`postgres://postgres:postgres@localhost:5432/app`) for
tests and `pnpm dev` data. Sign-in in local development needs the provider's project, or the dev bypass: `DEV_LOGIN=1` with
`pnpm dev` (any email, code `000000`, or `/api/dev-login?email=…`; `apps/web/lib/auth/dev.ts`). The
e2e suite uses it. It cannot be switched on in a production build.
