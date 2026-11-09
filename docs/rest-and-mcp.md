# REST API and MCP

Both are generic doors onto the action registry, so a rule written once holds everywhere, and an AI
can never do more than the person whose key it holds.

## API keys

Create one in Admin → API keys (`apiKeys.create`, permission `api_keys.manage`). The key looks like
`app_sk_…`, acts as its owner (optionally limited to some of their permissions) and is shown once.
A key stops working when its owner is archived. Everything a key does is in the activity log, reads included.

## REST

- `GET /api/v1/actions` lists the actions the key may run, with JSON Schemas for inputs.
- `GET /api/v1/openapi.json` is an OpenAPI 3.1 document generated from the same schemas.
- `POST /api/v1/actions/<name>` with a JSON body runs one:

```bash
curl -X POST "$APP_URL/api/v1/actions/contacts.list" \
  -H "Authorization: Bearer $APP_API_KEY" -H 'Content-Type: application/json' -d '{"tag":"customer"}'
```

Answers `{ ok: true, data }` or `{ ok: false, error: { code, message, ref? } }` with HTTP 400/401/403/404/409/429/500.
`429` has `Retry-After`. Send an **`Idempotency-Key`** on changes: the same key within 24 h returns the first
result (`Idempotent-Replayed: true`). Browser calls from the site itself use the cookie and must be same-origin JSON.

## MCP

`POST /api/mcp` with the same bearer key. Every action the key may run is a tool; dots become
underscores (`contacts.create` → `contacts_create`). Changes take an optional `idempotencyKey` argument.
Public and system-only actions are not tools. A tool the key may not run is simply absent: calling it is a
JSON-RPC "invalid params" error; a tool that runs but fails (bad input, a rule) returns `isError: true` with the
reason (and the `E-…` reference for bugs).

The route uses the **official `@modelcontextprotocol/sdk`** (Streamable HTTP, **stateless**: a fresh `Server` and
`WebStandardStreamableHTTPServerTransport` per request, JSON responses, no sessions, no `Mcp-Session-Id`). The
tool list comes from the action registry as plain JSON Schema, so it uses the SDK's low-level `Server` rather
than `McpServer`. `GET` / `DELETE` answer 405 (there is no stream or session). A missing `Accept` header is
filled in for curl users. To change what MCP offers, change `toolsFor()` in `apps/web/app/api/mcp/route.ts`.

Connect Claude Code: `claude mcp add --transport http app https://your-site/api/mcp --header "Authorization: Bearer app_sk_…"`.

## Removing the module

Delete `apps/web/app/api/v1/actions`, `.../openapi.json`, `apps/web/app/api/mcp` (and `api/v1/_lib` if
nothing else uses it — the webhook and newsletter routes import it), then `@modelcontextprotocol/sdk` from
`apps/web/package.json`. `api-keys.ts` stays if other code needs keys.

## Testing the routes

`pnpm --filter web test` runs Vitest against the route handlers directly (`GET` / `POST` imported from
`app/api/**/route.ts`, called with Web `Request`s) and a real local Postgres — its own database
(`app_test_web`), so it can run at the same time as the core tests. No browser, no `next dev`. Files in
`apps/web/test/api/`: `rest.test.ts` (auth, permissions, idempotency replay, 429 + `Retry-After`, `openapi.json`
validity), `mcp.test.ts` (JSON-RPC conformance: initialize, ping, tools/list, tools/call success / invalid input /
refusal, batch, 401, 405), `webhooks.test.ts` (signatures, replays, dedupe, 503/413), `misc.test.ts` (healthcheck,
push key, cron auth, newsletter links). `test/helpers.ts` has `makeKey(roles)` (a contact + API key),
`request()` and `resetDatabase()`. Browser tests stay in `e2e/` (Playwright).

## Other routes

| Route                                     | What                                                                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/push/public-key`                | The VAPID public key for `pushManager.subscribe` (`{ configured, publicKey }`).                                                                                                       |
| `POST /api/webhooks/resend`, `…/quo`      | Provider webhooks, signature-verified (docs/notifications.md → Webhooks).                                                                                                             |
| `GET/POST /api/v1/newsletter/confirm`     | The double opt-in link in the confirmation email.                                                                                                                                     |
| `GET/POST /api/v1/newsletter/unsubscribe` | The newsletter's unsubscribe link (one-click POST works).                                                                                                                             |
| `GET /api/healthcheck`                    | Shallow: database + crons. `?deep=1` + `Authorization: Bearer $CRON_SECRET` also checks storage, Resend, Quo, VAPID keys and webhook secrets **without sending anything** (`deep/*`). |
| `GET /api/cron/jobs`, `…/maintenance`     | Scheduled work (docs/notifications.md → Cron); they log one JSON line per run.                                                                                                        |

## Useful actions for clients

`search.query { q, limit }` (the ⌘K palette: contacts, tags, docs, automations, inquiries, errors by `E-…`
reference, activity — each `{ type, id, title, subtitle, href }`, only what the caller may see),
`notifications.recent` / `markAllRead` (the bell), `flags.list` / `flags.set` (feature flags), `contacts.exportCsv`,
`activity.exportCsv`, `contacts.import` (always dry-run first), `contacts.bulkAddTags`, `contacts.bulkArchive`.
