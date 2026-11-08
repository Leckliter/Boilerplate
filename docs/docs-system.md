# The docs system

In-app help at `/docs`: short Markdown pages, public ones for everyone and internal ones for staff.
Code: `apps/web/content/docs/<section>/<name>.md` (the pages), `packages/core/src/docs/` (types,
sections, the safe Markdown renderer, `canReadDoc`), `scripts/build-docs.ts`, actions `docs.list` and
`docs.get`, pages `apps/web/app/(site)/docs` and `components/docs`.

## Writing a doc

```markdown
---
title: Runbook, errors
summary: One sentence saying what the reader will learn (max 160 characters).
audience: internal
order: 1
---

Plain words. Start sections at `##` (the title is the heading).
```

`audience` is required — there is no default: `public` (everyone, including search engines) or
`internal` (anyone with `docs.internal`, every staff role). Keep a doc under 350 words; split it
otherwise. A new folder is a new **section**: add it to `packages/core/src/docs/sections.ts`.

## Build

`pnpm --filter @app/core docs:build` validates every doc (front matter, section, length, `/docs/...`
links, public docs never linking to internal ones) and renders them into `packages/core/src/docs/docs.generated.ts`
(committed). `docs:build --check` fails when it is stale. The root `package.json` should have
`"docs:build": "pnpm --filter @app/core docs:build --"` and run it in `check`.

## Who can read what

`canReadDoc(actor, doc)` is the one rule; pages, `docs.list`, `docs.get` and search all use it. For
anyone who may not read an internal doc it is **not found**, the same answer as a doc that does not exist.

## The renderer

`parseMarkdown` supports `##`–`####`, paragraphs, bullet and numbered lists, fenced code, quotes, tables,
rules and inline bold, italic, code and links. HTML in a doc is shown as text, never interpreted, and only
`http(s)`, `mailto`, site paths and `#anchors` stay links.

## Removing the module

Delete `packages/core/src/docs`, `actions/docs`, `scripts/build-docs.ts`, `apps/web/content`,
`apps/web/app/(site)/docs`, `components/docs`, the `modules.ts` line and the nav row.
