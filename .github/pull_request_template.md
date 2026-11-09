## What and why

<!-- One or two sentences: what changes for a person using the app, and why. Link the issue or the error reference (E-XXXXXXXX). -->

## Checklist

- [ ] `pnpm check` passes (typecheck, lint, rules, format, generated docs, tests)
- [ ] Business reads/writes go through an action, with a "works" test and tests for its refusals (docs/actions.md)
- [ ] Schema change = a new Drizzle migration (never an edited one); a new table calls `app.track_changes`
- [ ] A screen or process changed: its doc is updated in this PR; the screen works at 320px wide
- [ ] `pnpm actions:docs` run and committed if actions or events changed
- [ ] New env var: added to `.env.example`, `docs/deploy.md` and (owner action) `TODO.md`
- [ ] Browser-visible change: `pnpm --filter web e2e` passes (or a spec added)

## How I tested it

<!-- Commands run, screens clicked, the e2e spec added. For a bug fix: the failing test that now passes. -->
