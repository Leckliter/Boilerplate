---
name: add-action
description: Add or change a business action (the only way data is read or changed). Use whenever a feature needs to create, read, update or delete business data — it automatically becomes available to the UI, REST API and MCP.
---

# Adding an action

Read docs/actions.md once per session. The rule: all business reads and writes go through an
action in `packages/core/src/actions`; `apps/web` never touches the database (`pnpm rules`).

1. Pick the name `<area>.<verb>` (camelCase verb): `projects.create`, `projects.archive`,
   `contacts.merge`. Check `docs/actions.generated.md` that it doesn't exist. Names are permanent.
2. Create `packages/core/src/actions/<area>/<verb>.ts` (or a small group file) and re-export it
   from `actions/<area>/index.ts`:

   ```ts
   export const archiveProject = defineAction({
     name: 'projects.archive',
     title: 'Archive project',
     description: 'Written for an AI reader: what it does, when to use it, gotchas.',
     audience: 'projects.write', // a permission, 'authenticated' or 'public'
     mutates: true, // true → activity log row
     returns: 'The updated Project',
     input: z.object({ id: z.uuid(), reason: z.string().max(500).optional().describe('Why') }),
     async run({ input, actor, tx, log }) {
       // use tx for EVERY query; throw new ActionError('not_found', '…') for expected failures
       log({ subjectType: 'project', subjectId: input.id, summary: 'Archived' });
       return updated;
     },
   });
   ```

3. New permission? Add it to `PERMISSIONS` and the right roles in
   `packages/core/src/access/permissions.ts`.
4. Add the area to the registry (`packages/core/src/actions/catalog.ts`) if it is new.
5. Something worth reacting to happened? `emit(tx, 'project.archived', data)` (new event →
   `packages/core/src/events/catalog.ts`). Telling someone? `notify(tx, …)` (skill
   `add-notification`). Both inside `run`, never in the UI.
6. Add a happy-path test in `packages/core/test/` (the file for its area). The "refused" test is
   automatic for every non-public action (`test/refusals.test.ts`). Test the refusals that are
   specific to the action too (which states, which owner). `pnpm actions:tests` fails if an action
   never ran successfully in the tests. Logging and error reports are automatic
   (docs/logging.md, docs/errors.md); a new table needs a migration (skill `add-migration`).
7. Run `pnpm actions:docs` and `pnpm check` (skill `finish-change`). Keep files under 750 lines.
8. **UI:** server components `callAction(action, input, viewer.actor)`; a form is
   `<ActionForm action="projects.archive">` (docs/actions.md → ActionForm); a button/other client
   code `useAction().run('projects.archive', input, { success: 'Archived' })`.

Never: `getDb()` inside a transaction (use `tx`), a slow outside call that holds the transaction
open for long, a permission check only in the UI, money as anything but integer cents.
