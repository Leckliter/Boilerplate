# Events

An **event** says "this happened": `contact.created`, `role.granted`, `error.new`. It is the one way
the rest of the system can react to a change without the action knowing who is listening.
Events and [automations](automations.md) are one module: `packages/core/src/{events,automations}`,
`actions/{events,automations}`, the line `import './automations/register'` in
`packages/core/src/modules.ts`, and the routes `apps/web/app/admin/automations`.
The full list is [events.generated.md](events.generated.md).

## Emitting

```ts
await emit(tx, 'contact.created', { contactId, displayName, email, phone, tags });
await emit(tx, 'error.new', data, { dedupeKey: ref }); // the same type + key is recorded once
```

- **Always inside the action's transaction** (`tx`). `emit` writes to `app.events` (an outbox) and
  queues the `events.dispatch` job in that transaction, so an event exists exactly when the change
  was saved, and cannot be lost once it was. `pnpm rules` fails `emit` anywhere in `apps/web`.
- **Add an event:** define it in `packages/core/src/events/catalog.ts` (description for a person
  building an automation, a zod `data` shape, `subject`, a realistic `example`), add it to
  `EVENT_TYPES`, call `emit`, run `pnpm actions:docs`. Names are permanent; data fields may be added,
  never removed or renamed. Keep data small (ids, names, numbers; money in cents).
- **Who emits what today:** `contacts.create/update/addTags/archive` → `contact.*`;
  `access.grantRole/revokeRole` → `role.*`; `apiKeys.create` → `api_key.created`; the error reporter →
  `error.new` / `error.spike`; sign-in → `user.signed_in` through the system action
  `events.recordSignIn` (call it with `systemActor()` from the web app's sign-in code); a failing
  automation → `automation.failed`.

## Dispatch

The `events.dispatch` job locks the event row and, in one transaction, cancels runs that stop on it,
resumes runs waiting for it, starts automations triggered by it, and sets `dispatched_at`. Running it
twice does nothing the second time. Jobs run right after each request that changed data and every
minute from cron (`runDueJobs()` then `runModuleTicks()`, see [notifications.md](notifications.md)).

## Looking at events

`events.list` (permission `automations.manage`) or Admin → Automations → runs. Events older than a
year are deleted by the daily maintenance job.

## Removing the module

Delete the two core folders, `actions/events`, `actions/automations`, the line in `modules.ts`, the
admin routes and nav row, then remove the `emit(` lines in `actions/contacts`, `actions/access` and
`actions/api-keys` (`grep -rn "emit(" packages/core/src/actions`), the alert handler goes with the
folder. Run `pnpm typecheck && pnpm rules && pnpm test`.
