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
Public and system-only actions are not tools. The route is a small stateless "Streamable HTTP"
implementation (`initialize`, `ping`, `tools/list`, `tools/call`) with no dependencies; to use
`mcp-handler` or the official SDK instead, replace `apps/web/app/api/mcp/route.ts` (the tools come from
the action registry either way).

Connect Claude Code: `claude mcp add --transport http app https://your-site/api/mcp --header "Authorization: Bearer app_sk_…"`.

## Removing the module

Delete `apps/web/app/api/v1/actions`, `.../openapi.json`, `apps/web/app/api/mcp` (and `api/v1/_lib` if
nothing else uses it). `api-keys.ts` stays if other code needs keys.
