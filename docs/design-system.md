# Design system

**Look:** neutral greys, hairline borders, `rounded-lg` controls, `rounded-xl` surfaces, barely-there
shadows, 100 ms transitions, neutral focus rings, one brand colour. **Names & code style:**
shadcn/ui conventions (so AI tools write it correctly). **Primitives:** Base UI. **Icons:** Phosphor.

Live reference: **`/brand`** on any environment — every component with live examples.

## Where things are

- Tokens: `packages/ui/src/styles/globals.css` — oklch colours (`light-dark()`, with a `.dark`
  override), radius, shadows, fonts. Change the brand here; everything follows.
- Components: `packages/ui/src/components/*.tsx`, imported as `@app/ui/components/<name>`.
- `cn()` class merger: `@app/ui/lib/utils`. Dates: `@app/ui/lib/dates`. Money: `@app/ui/lib/money`.
- Icons: **Phosphor**, imported from `@app/ui/components/icons` (never from `@phosphor-icons/react`)
  with the `…Icon` names, e.g. `PlusIcon`, sized `className="size-4"`. That file lists every icon and
  sets the default weight (**light**); active/selected passes `weight="fill"`.
- Logo artwork: `apps/web/public/brand/`; in the app use `<Logo />` (or `<Logo compact />`).

## Brand by one token

The brand is one ramp, `--brand-50 … --brand-900`, in `globals.css`. The neutral default is
indigo-ish. `--primary` is `--brand-500`; hover, focus rings, tinted surfaces and badges derive from
the ramp, never from a second hard-coded colour. To rebrand, replace the ten ramp values (generate
them from one colour in oklch: keep the hue, step lightness from ~97% at 50 to ~25% at 900, ease
chroma toward the ends) and replace the logo. Nothing else changes. `THEME_COLORS` in
`@app/ui/lib/theme-colors` mirrors the two or three values that must be literal strings (web
manifest, `<meta name="theme-color">`); update it with the ramp.

## Dark-mode lightening rule

In dark mode surfaces get **lighter** with elevation, they do not invert: background → card →
popover → raised each step a little lighter (`oklch` lightness +3–4 points), borders are a
translucent white, shadows nearly vanish. Tinted surfaces (`success-tint`, `warning-tint`, brand
tints) keep their hue but drop to a dark, low-chroma tint and the text on them lightens to ~85%
lightness — never a pale tint with white text, never inverted pastel. A new token is defined once with
`light-dark(<light>, <dark>)`; check both at `/brand` before shipping.

## Rules

1. Use tokens (`bg-primary`, `text-muted-foreground`, `border-border`), never hex, rgb, oklch or
   Tailwind palette classes in `apps/web` (`pnpm rules`: `no-raw-colour`).
2. One `primary` button per screen; `secondary` is the default button; `destructive` only for
   delete/cancel/revoke, after a `confirm()`.
3. Every form control sits inside `<Field label hint error>` (it links the hint/error to the control
   for screen readers). Checkboxes use `<CheckboxField>`, radio choices `<RadioCard>`.
4. Every app screen starts with `<PageHeader title description actions>`.
5. Lists use `<Table>` inside a `<Card>`, the whole row is the link; empty lists show `<Empty>`.
6. Icons only from `@app/ui/components/icons` (`pnpm rules`: `icons-from-ui-only`).
7. Admin/portal screens work with touch: buttons at least 40 px high on phones, no hover-only actions.
8. Copy: sentence case, plain words, buttons say what happens ("Save changes", not "Submit").
9. Record pages show details read-only (`<DetailList>`/`<DetailItem>`) in an `<EditableCard>` per
   section; Edit turns that one card into a form. Never leave a record's fields open as a form.
   Create pages (`/new`) are plain forms (`<ActionForm>`).
10. Record pages start with `<RecordHeader back title badges meta actions>`; totals use `<SummaryList>`.
11. Ask first with `await confirm({ title, confirmLabel })` (or `prompt()` / `alert()`) from
    `@app/ui/components/alert-dialog`. Never `window.confirm` (`pnpm rules`: `no-browser-dialog`).
    Notices use `<Callout>`; tabs use `Tabs` / `TabbedPanels` / `FilterLinks`.
12. Every screen works on a **320px**-wide phone with no sideways scrolling. In a flex row give the
    text side `min-w-0` (so `truncate` works) and let rows of buttons/chips `flex-wrap`; no fixed
    `w-48` labels; wide tables scroll inside their `<Table>`. `globals.css` lets grid cells shrink.
13. New component → add it to `packages/ui` **and** a demo on `/brand`, written shadcn-style on a Base
    UI primitive (`@base-ui/react/<part>`) with the existing ones as the pattern. A `<DropdownMenuLabel>`
    always sits inside a `<DropdownMenuGroup>`.

## Components available

Button (+`buttonVariants` for links), Input, Textarea, NativeSelect, Label, Field, Card
(+Header/Title/Description/Content/Footer), Badge, Table, Dialog, AlertDialog and the
`confirm()`/`prompt()`/`alert()` helpers (`<DialogsHost />` is mounted in the root layout),
DropdownMenu (+Group/RadioGroup), Tabs/TabbedPanels/FilterLinks, Tooltip, Toaster/`toast`, Avatar,
Separator, PageHeader, Empty, Skeleton, Logo, Prose, Callout (+`calloutVariants`), DetailList/
DetailItem, EditableCard, RecordHeader, SummaryList/SummaryRow, Checkbox/CheckboxField, RadioCard,
CopyButton/ErrorReference, FileDrop, CodeBlock, CommandPalette, TagInput, Autocomplete, CountBadge.
Form wiring in apps/web: `ActionForm`, `FormDialog`, `DeleteForm` ([actions.md](actions.md)).

Added in the kit v2: DataTable (+ActionBar), StatTile, Sparkline/BarChart/DonutChart (SVG, `--chart-1…6`),
Timeline, Wizard, AvatarUpload, NotificationList, KeyValueList, SearchInput, PageActions/MobileActionBar,
Pill/StatusDot, ConfirmButton, Kbd, ThemeToggle, LanguageSelect, Accordion, Progress, InlineEdit, and
FileDrop/DropZone `status` states. (CopyableCode already exists as `ClipboardText`/`CodeBlock`.) Calendar
event colours are `--event-<name>[-tint|-ink]` tokens. `<Logo tone="onBrand">` on brand backgrounds.
Tests: `pnpm --filter @app/ui test` (vitest + Testing Library + jest-axe; `test/axe.ts`).

## Words inside components: `labels`

Components that say something themselves (ThemeToggle, Wizard, Steps, NotificationList, DataTable, and
Tabs' scroll buttons) take an optional `labels` prop with English defaults, so the UI package needs no
i18n library. In `apps/web` use the hooks in `lib/ui-labels.ts` (`useTableLabels()`,
`useWizardLabels()` …; messages under `ui.*` in `messages/*.json`): `<DataTable labels={useTableLabels()} … />`.
Avatar takes `src` (a picture, with the initials as the fallback) and `alt` (a labelled image when it
stands alone); Sparkline takes `width` (pixels or `'fill'`) and `height`.

## Time zone in client components

`formatDate` etc. default to the module zone (`APP_TIME_ZONE`, set on the server). Browsers don't see
that env, so mount `<TimeZoneProvider zone={getAppTimeZone()}>` (`@app/ui/components/ui-context`) once in
`AppProviders` with the server's zone, and in client components use `useAppTimeZone()` or
`const { formatDate, formatDateTime } = useDates()`. Every formatter also takes a trailing `zone`
argument. Timeline and NotificationList already use `useDates()`. (Web worker: mount the provider.)

Server components use `getServerDates()` (`apps/web/lib/dates-server.ts`): the same formatters bound to the
signed-in person's time zone (the `tz` cookie, set under Account → Preferences), else `APP_TIME_ZONE`.
Don't import `formatDate` from `@app/ui/lib/dates` in an admin or account page: it ignores the cookie.

Helpers: `formatMoney(cents, { currency, trimZeros })`/`parseMoneyToCents` (alias `parseMoney`) (`@app/ui/lib/money`, integer cents), `formatDate`/
`formatDateTime`/`formatDay` (`@app/ui/lib/dates`, always in `APP_TIME_ZONE`, default
`America/Chicago`; storage is UTC). A literal colour string: `THEME_COLORS`.
