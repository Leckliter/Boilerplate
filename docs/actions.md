# Actions — how all business logic is written

An **action** is a named, validated, permission-checked, logged operation, like `contacts.create`
or `projects.archive`. It is the ONLY way business data is changed. Everything calls actions:

| Caller                     | How                                                               |
| -------------------------- | ----------------------------------------------------------------- |
| Server components          | `callAction(listContacts, { tag: 'lead' }, viewer.actor)`         |
| Forms                      | `<ActionForm action="contacts.create">` (below)                   |
| Other client code          | `useAction().run('contacts.addTags', { id, tags: ['customer'] })` |
| REST API                   | `POST /api/v1/actions/contacts.create` with a JSON body           |
| AI assistants (MCP)        | tool `contacts_create`                                            |
| Scripts / crons / webhooks | `callAction(x, input, systemActor())`                             |

A rule written once (e.g. "emails must be unique") holds everywhere, and an AI can never do
something its owner couldn't.

## Anatomy

```ts
// packages/core/src/actions/projects/archive.ts
export const archiveProject = defineAction({
  name: 'projects.archive',
  title: 'Archive project',
  description: 'Written for an AI reader: what it does, when to use it, gotchas.',
  audience: 'projects.write', // a permission, 'authenticated' or 'public'
  input: z.object({ id: z.uuid(), reason: z.string().max(500).optional() }),
  mutates: true,
  async run({ input, actor, tx, log }) {
    // every query uses tx; ActionError for expected failures
    log({ subjectType: 'project', subjectId: input.id, summary: 'Archived' });
    return updated;
  },
});
```

Fields: `name`, `title`, `description` (becomes the MCP tool description), `audience`, `input` (zod),
`mutates`, optional `returns`, `logInput`, `rateLimit` and `humanCheck`, and
`run({ input, actor, tx, log })`. One file per action or group, re-exported from
`actions/<area>/index.ts`.

`runAction` does, in order:

1. Permission check against the **actor** (guest → `unauthenticated`, else `forbidden`).
2. Input validation → `invalid_input` with readable messages and `fieldErrors`.
3. `run()` inside a database transaction.
4. One `activity_log` row in the same transaction (who, which channel, from where, what) for every
   change, every API-key call (reads too) and every denied attempt — see [logging.md](logging.md).
5. An unexpected error (anything but an `ActionError`) becomes an error report with a reference —
   see [errors.md](errors.md).

Result: `{ ok: true, data } | { ok: false, error: { code, message, ref?, fieldErrors? } }`. `ref`
exists only for `internal` errors. Expected failures throw `ActionError(code, message)` with a code
such as `not_found`, `conflict`, `invalid_input`, `forbidden`.

## ActionForm and useAction — the UI side

A new screen is one `defineAction` plus one form. `invokeAction(name, input)` (`apps/web/lib/invoke.ts`)
is the single server action that runs any action for the signed-in user.

```tsx
<ActionForm action="projects.create" success="Project created">
  <Field label="Name" name="name" required />
  <Field label="Budget" name="budget" />
  <Button type="submit">Create project</Button>
</ActionForm>
```

`<ActionForm>` (`apps/web/components/forms/action-form.tsx`) uses `useActionState`; it converts
FormData to the action's zod input (numbers, booleans, repeated fields; or pass `transform`), puts
each field's `fieldErrors` under its `<Field>`, toasts on success, refreshes the page, closes the
enclosing dialog, and on failure shows the message plus the `E-…` reference with a copy button.
Around it: `<FormDialog>` (Add/Edit button in a page's actions, closes and resets on save) and
`<DeleteForm>` (confirms first; use `inDialog` at the foot of an Edit dialog).

`useAction()` (`lib/use-action.ts`) is the hook for buttons and anything that is not a form:
`const { run, pending } = useAction(); await run('projects.archive', { id }, { success: 'Archived' })`.
It toasts, shows the reference and refreshes. Never write a hand-rolled server action per form,
and never `next-safe-action` (`pnpm rules`: `no-next-safe-action`).

## Abuse protection (public actions)

- **`rateLimit: { limit, perSeconds }`**: at most `limit` calls per window, counted per signed-in
  person, API key, or (guests) IP. Over the limit → `rate_limited` (REST: HTTP 429 with
  `Retry-After`). Counters live in `app.rate_limit_hits`. Put it on every public action that writes
  or costs money.
- **`humanCheck: true`**: guests must pass a bot check (Cloudflare Turnstile); off until its keys are set.

## Idempotency keys (API and AI)

Send the same **`Idempotency-Key`** header (REST) or `idempotencyKey` argument (MCP) to repeat a
change safely: within 24 hours the same caller + key returns the first result (`Idempotent-Replayed:
true`). Same key, different action or input → `conflict`. Only successes are remembered; the key is
claimed inside the action's transaction. Table `app.idempotency_keys`.

## Background work and reactions

After-commit or retried work: `enqueue(tx, 'type', payload)`. Something worth reacting to:
`emit(tx, 'project.archived', data)`. Telling someone: `notify(tx, …)`. All three are called inside
`run`, with the `tx` you were given — never `getDb()` in a transaction.

## Public forms and data tools

- **A public form** is an action with `audience: 'public'`, a `rateLimit`, `humanCheck: true` and a honeypot field
  (see `inquiries.create`, `newsletter.subscribe`): it never leaks whether something exists, and stores nothing
  for bots. People who reach out become a `lead` contact (`findOrCreateLead`), never a second record.
- **Exports of personal data** (`contacts.exportCsv`, `activity.exportCsv`; permission `data.export`) are declared
  `mutates: true` on purpose: that puts an audit row in the activity log and makes AI clients ask first. They
  return CSV text with a row cap (`truncated: true`), formula-safe cells.
- **Bulk and import** (`contacts.bulkAddTags`, `contacts.bulkArchive`, `contacts.import`) run in ONE transaction
  with ONE activity entry that says how many; the last active owner can never be archived through them. Imports
  take `dryRun: true` first: per-row `problems`, dedupe by email, nothing saved.
- **Feature flags** are settings (`flags.<name>`): `isEnabled('flag', actor?)` from `@app/core` in pages and route
  handlers, `isEnabled('flag', actor, tx)` inside an action (never `getDb()` there); `flags.list` / `flags.set`
  change them (`packages/core/src/flags.ts` lists the flags the code knows, rollout rules and the sample flags).
- **System-only actions** (`webhooks.*`, `account.processDeletions`, `account.exportPayload` …) are how webhooks,
  jobs and cron change data: routes and jobs call them with `systemActor()` so they get a transaction, an activity
  row and events like everything else.

## Naming

`<area>.<verb>`, verb in camelCase: `contacts.create`, `contacts.addTags`, `access.grantRole`. What
kind of contact someone is, is a tag passed to `contacts.create`, not a separate action. Names are
permanent once shipped (the API and AI integrations depend on them).

## Adding one

Follow `.claude/skills/add-action/SKILL.md`, then `pnpm actions:docs`. The catalog is
[actions.generated.md](actions.generated.md) — generated from code; CI fails if stale.
