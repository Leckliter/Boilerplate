---
name: fix-error
description: Fix a production/test error from its reference (E-XXXXXXXX or a numeric Next.js digest) or a pasted error report. Use whenever the user gives an error reference, pastes a "# Error E-…" report, or says something broke with a reference.
---

# Fixing an error from its reference

How error reports work: docs/errors.md.

1. **Get the report.**
   - Pasted "# Error E-…" Markdown → you have it.
   - Only a reference → fetch it: MCP tool `errors_get` `{ "ref": "E-…" }` if the app's MCP
     server is connected; otherwise REST, if `APP_URL` (the site, e.g. `https://example.com`) and
     `APP_API_KEY` (an owner/admin API key) are set. The brief is Markdown in `data.brief`:
     ```bash
     curl -s -X POST "$APP_URL/api/v1/actions/errors.get" \
       -H "Authorization: Bearer $APP_API_KEY" -H 'Content-Type: application/json' \
       -d '{"ref":"E-…"}' | jq -r .data.brief
     ```
     Point `APP_URL` at the test site for test-site errors. Neither available → ask the user for
     **Admin → Errors → the error → Copy for AI agent**.
   - "No error report" → wrong environment, or the DB was down: search the host's runtime logs
     for the reference.
2. **Read the brief in order:** diagnosis (`code` + hint), action and redacted input, actor,
   environment, deployed commit, stack, occurrence count. `db.*`, `config.*`, `auth.*`, `net.*`
   are usually environment problems (migration not applied, env var missing/wrong, service down) —
   fix the environment or tell the user what to change; don't patch code around them.
3. **Find the code as deployed:** `git show <commit>:<path>` using the report's commit. Start from
   the action name / route and the first stack frame that names our code (deployed paths point
   into `.next/` bundles — map function names back to `packages/` or `apps/web/`). Check whether
   `main` already changed it since.
4. **Reproduce** with a Vitest test in `packages/core/test` using the report's input
   (docs/testing.md). Fix the cause, not the symptom: a missing check becomes an
   `ActionError('not_found' | 'conflict' | 'invalid_input', …)` with a clear message, or a tighter
   zod input schema.
5. If the fix teaches something general, add a rule to `packages/core/src/errors/diagnose.ts`
   (with a test in `logging.test.ts`).
6. `pnpm check`, commit, push (branch flow in AGENTS.md).
7. **Close it** once deployed: `errors.resolve` `{ "ref": "E-…", "resolution": "Fixed in <sha> — <what>" }`
   (or ask the user to click **Mark fixed**). Repeats of the same bug close with it.
