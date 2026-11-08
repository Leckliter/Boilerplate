---
name: add-screen
description: Build or change a page/screen in the public site, customer portal (/account) or admin (/admin). Use for any UI work — new pages, forms, lists, dialogs, notices.
---

# Building a screen

Read once per session: docs/design-system.md. See every component live at `/brand`.

1. **Where:** `apps/web/app/(site)/` public · `app/account/` portal · `app/admin/` admin. Shared
   pieces in `apps/web/components/<area>/`.
2. **Data:** server components call `callAction(action, input, viewer.actor)` after
   `const viewer = await requireViewer()`. **A form is `<ActionForm action="area.verb">`** with
   `<Field>` controls: it turns FormData into the action's zod input, shows per-field errors,
   toasts, refreshes, closes an enclosing dialog and shows the `E-…` reference with a copy button
   on failure. Add/Edit in a page's actions is `<FormDialog>`; delete is `<DeleteForm>` (confirms
   first). Other client code: `useAction().run('area.verb', input, { success: 'Saved' })`. Never
   import `@app/db` or `drizzle-orm` in `apps/web` (`pnpm rules` fails). Missing data? Add or
   extend an action (skill `add-action`). A new screen is usually one `defineAction` + one `<ActionForm>`.
3. **Permissions:** the action enforces them. The UI may _hide_ what the viewer can't do
   (`viewer.can('projects.write')`), never relies on hiding.
4. **Layout:**
   - Start with `<PageHeader title description actions>`; record pages `<RecordHeader>`.
   - Lists: `<Table>` inside a `<Card>`, the whole row is the link; empty → `<Empty>`.
   - A record's fields: read-only in an `<EditableCard>` (Edit turns that card into a form).
   - Forms: every control in `<Field label hint error>`. One `primary` button per screen;
     `secondary` is the default; `destructive` only for delete/cancel/revoke, after `confirm()`.
   - Notices: `<Callout tone="warning|danger|info|success">`. Never hand-build a coloured box.
   - Tabs: `Tabs` / `TabbedPanels`; URL-driven tabs `FilterLinks`. Never a hand-built tab row.
   - A `<DropdownMenuLabel>` sits inside a `<DropdownMenuGroup>`.
   - Loading: `loading.tsx` with `<Skeleton>` in the shape of the content.
5. **Colours and icons:** tokens only (`bg-primary`, `text-muted-foreground`, `border-border`,
   `text-success`, `text-destructive`). No hex/rgb/oklch, no Tailwind palette classes. Icons are
   Phosphor from `@app/ui/components/icons` only (`PlusIcon`; add a missing one to that file).
   Both are checked by `pnpm rules`.
6. **Phone first:** check it at 320 px. A flex row needs `min-w-0` on the text side and
   `flex-wrap` on button rows, no fixed `w-48` labels.
7. **Missing component?** Add it to `packages/ui/src/components/<name>.tsx` (shadcn-style on a
   Base UI primitive) AND a demo on `/brand`, and list it in docs/design-system.md.
8. **Words:** sentence case, plain short words, buttons say what happens ("Save changes", not
   "Submit"). No "successfully", "utilize", "please note".
9. **Errors:** never swallow one. Unexpected → `reportError(err, { source, … })` and show the
   reference (`<ErrorReference>`); expected (bad input, offline) → say so in a comment and tell
   the person what to do. Dates: `formatDate` / `formatDateTime` from `@app/ui/lib/dates`.
10. **Docs:** a screen people use gets updated in-app help if the docs module is present.
11. **Check it:** `pnpm check`. For a visible change run the app and look at it, phone-sized too.
