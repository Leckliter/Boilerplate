---
name: finish-change
description: Wrap up a change before committing — regenerate docs, run every check, update TODO/decisions, commit and push. Use at the end of every task that changed code or docs, and whenever the user says "ship it", "commit", "push" or "merge".
---

# Finishing a change

Do every step; each one is something CI or the next AI session would otherwise trip over.

1. **Generated files.** Changed an action or event → `pnpm actions:docs`. Never hand-edit
   `*.generated.*`.
2. **Docs match the code.** A screen or process changed → its doc changed in the same commit. A
   developer-facing system changed → its `docs/*.md`. New env var → `.env.example`, the doc's
   setup section, and the owner's list in TODO.md if the owner must set it.
3. **Run everything:** `pnpm check` — typecheck, lint, `pnpm rules`, format, the generated-docs
   check, tests against local Postgres, and `pnpm actions:tests`. Fix what it reports; don't
   silence it. `rules-ok:` comments need a reason a reviewer would accept. `pnpm format:fix`
   fixes formatting.
4. **Lists.** Tick finished items in TODO.md and add follow-ups you found. A decision with a
   "why" → append to docs/decisions.md (`date — decision — why`). A mistake an AI made that a rule
   would have prevented → add it to "Common mistakes" in AGENTS.md (or better, to
   `scripts/check-rules.mjs`).
5. **Commit** with a message that says what changed and why, in plain words.
6. **Push** to the feature branch and open a PR. Never push straight to `main`; never force-push
   `main`/`dev`.
7. **Tell the user** what changed, what you checked, and anything only they can do — in plain
   words, no jargon.
