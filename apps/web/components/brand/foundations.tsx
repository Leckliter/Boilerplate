import { Callout } from '@app/ui/components/callout';
import { cn } from '@app/ui/lib/utils';
import type * as React from 'react';

/** Foundations that are plain markup: type scale, spacing, radius, shadow, accessibility, voice. */

const mono = 'font-mono text-xs';

export function TypographyScale() {
  const rows: [string, string, string][] = [
    ['text-4xl font-semibold tracking-tight', 'Page hero', '36 / 40'],
    ['text-2xl font-semibold tracking-tight', 'Page title (PageHeader)', '24 / 32'],
    ['text-lg font-semibold', 'Section title', '18 / 28'],
    ['text-base font-semibold', 'Card title, table header', '16 / 24'],
    ['text-base', 'Body, controls', '16 / 24'],
    ['text-sm', 'Dense body, descriptions', '14 / 20'],
    ['text-sm text-muted-foreground', 'Secondary text', '14 / 20'],
    ['text-xs text-muted-foreground', 'Hints, meta, captions', '12 / 16'],
    ['font-mono text-xs', 'Ids, codes, commands (Geist Mono)', '12 / 16'],
  ];
  return (
    <div className="grid gap-5">
      <ul className="grid gap-3">
        {rows.map(([cls, use, size]) => (
          <li
            key={cls + use}
            className="grid min-w-0 gap-1 border-b border-hairline pb-3 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-baseline sm:gap-6"
          >
            <p className={cn(cls, 'min-w-0 break-words')}>The quick brown fox jumps</p>
            <p className="min-w-0 text-xs text-muted-foreground">
              {use} · {size} · <code className={mono}>{cls}</code>
            </p>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        Inter for everything (variable weight; we use 400, 500, 600), Geist Mono for codes. Sentence
        case everywhere. Numbers in tables and tiles use <code className={mono}>tabular-nums</code>.
        Line length of long text stays under about 70 characters (
        <code className={mono}>max-w-2xl</code>).
      </p>
    </div>
  );
}

export function SpacingRadiusShadow() {
  const spacing = ['1', '2', '3', '4', '5', '6', '8', '10', '12'];
  const radii: [string, string][] = [
    ['rounded-sm', 'Chips, tiny buttons'],
    ['rounded-md', 'Small controls'],
    ['rounded-lg', 'Buttons, inputs, cards'],
    ['rounded-xl', 'Dialogs, big surfaces'],
    ['rounded-full', 'Avatars, pills'],
  ];
  const shadows: [string, string][] = [
    ['shadow-xs', 'Cards at rest'],
    ['shadow-sm', 'Raised: menus, tiles'],
    ['shadow-lg', 'Popovers and dialogs (adds a 1px ring)'],
  ];
  return (
    <div className="grid gap-8">
      <div>
        <h3 className="mb-2 text-base font-semibold">Spacing</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Tailwind&apos;s 4px scale. Gaps between related things are 2–3, between groups 4–6,
          between page sections 8–10. Page gutter is 16px (<code className={mono}>px-4</code>) on
          phones.
        </p>
        <ul className="grid gap-1.5">
          {spacing.map((n) => (
            <li key={n} className="flex items-center gap-3 text-xs">
              <code className={cn(mono, 'w-10 shrink-0')}>{n}</code>
              <span className="w-10 shrink-0 text-muted-foreground">{Number(n) * 4}px</span>
              <span
                className="h-3 rounded-sm bg-primary"
                style={{ width: `calc(var(--spacing) * ${n})` }}
              />
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 text-base font-semibold">Radius</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          One base radius token (<code className={mono}>--radius</code>, 10px); the steps derive
          from it.
        </p>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {radii.map(([cls, use]) => (
            <li key={cls} className="grid min-w-0 gap-1.5">
              <span className={cn('h-14 bg-fill ring ring-border', cls)} />
              <code className={mono}>{cls}</code>
              <span className="text-xs text-muted-foreground">{use}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 text-base font-semibold">Shadow</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Barely-there. Surfaces are separated mostly by a 1px ring (
          <code className={mono}>ring ring-border</code>); in dark mode shadows nearly vanish and
          elevation is shown by a lighter surface.
        </p>
        <ul className="grid gap-4 sm:grid-cols-3">
          {shadows.map(([cls, use]) => (
            <li key={cls} className="grid min-w-0 gap-1.5">
              <span className={cn('h-16 rounded-xl bg-card ring ring-border', cls)} />
              <code className={mono}>{cls}</code>
              <span className="text-xs text-muted-foreground">{use}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const CHECKS: [string, React.ReactNode][] = [
  [
    'Names',
    'Every control has an accessible name: a visible label (`<Field label>`), or `aria-label` on icon-only buttons.',
  ],
  [
    'Keyboard',
    'Everything works with Tab, Shift+Tab, Enter, Space, Escape and arrows. Nothing is hover-only. Focus is always visible (2px neutral ring).',
  ],
  [
    'Focus',
    'Dialogs trap and return focus (Base UI does it). After a step change or a route change, focus lands on the new heading.',
  ],
  [
    'Contrast',
    'Text 4.5:1, large text and icons 3:1, in light and dark. Check the contrast table above after changing a token.',
  ],
  [
    'Not by colour alone',
    'Status always has words or an icon too: Pill, StatusDot (label), StatTile (arrow + "up/down"), unread items ("Unread").',
  ],
  [
    'Structure',
    'One h1 per page (PageHeader), headings in order, landmarks (`main`, `nav` with aria-label), real lists, tables and description lists.',
  ],
  [
    'Tables',
    '`<caption>`, `<th scope>`, `aria-sort` on sortable headers. Wide tables become cards on phones, not sideways scrolling.',
  ],
  [
    'Live updates',
    'Toasts and counts announce politely (`aria-live="polite"`); errors in forms use `role="alert"` and `aria-describedby`.',
  ],
  [
    'Touch',
    'Targets at least 40px high on phones; 8px between neighbours. Works at 320px wide with no sideways page scroll.',
  ],
  [
    'Motion',
    'Animation is short (100–150ms) and off for people who prefer reduced motion (`motion-safe:` / `motion-reduce:`).',
  ],
  [
    'Charts',
    'Every chart is an `img` with a title and summary plus a data table fallback. Never the only place a number appears.',
  ],
  [
    'Zoom and text size',
    'No fixed heights on text containers; layouts survive 200% zoom and long translations.',
  ],
];

export function AccessibilityChecklist() {
  return (
    <div className="grid gap-4">
      <ul className="grid gap-2 sm:grid-cols-2">
        {CHECKS.map(([title, body]) => (
          <li key={title} className="min-w-0 rounded-lg bg-card p-3 ring ring-border">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">{body}</p>
          </li>
        ))}
      </ul>
      <Callout tone="info">
        <strong>Automated checks.</strong> The ui package runs axe (jest-axe) on key components in{' '}
        <code className={`${mono} break-all`}>pnpm --filter @app/ui test</code>. axe finds about a
        third of real issues: still try the keyboard and a screen reader on anything new.
      </Callout>
    </div>
  );
}

const VOICE: [string, string, string][] = [
  ['Plain and short', 'Your booking is confirmed.', 'Reservation successfully processed.'],
  ['Say what happens on buttons', 'Create project · Send reminder', 'Submit · OK · Click here'],
  [
    'Errors: what went wrong, how to fix',
    'That email is already in use. Sign in instead?',
    'Error 409.',
  ],
  [
    'Empty states invite the first action',
    'No orders yet. Orders you take will show up here.',
    'No data.',
  ],
  ['Sentence case everywhere', 'Add a customer', 'Add A Customer'],
  [
    'We and you, never "the platform"',
    'We will email you when it ships.',
    'The user will be notified.',
  ],
  ['Confirm with the verb', 'Delete note · Cancel order', 'Yes · Confirm'],
  [
    'Numbers and dates the way people say them',
    '$49.00 · Nov 3, 2026 · 3 items',
    '4900 · 2026-11-03T00:00Z · 3 item(s)',
  ],
];

export function VoiceAndCopy() {
  return (
    <div className="grid gap-4">
      <ul className="grid gap-2">
        {VOICE.map(([rule, yes, no]) => (
          <li
            key={rule}
            className="grid min-w-0 gap-2 rounded-lg bg-card p-3 ring ring-border sm:grid-cols-[14rem_minmax(0,1fr)_minmax(0,1fr)] sm:items-start"
          >
            <p className="text-sm font-medium">{rule}</p>
            <p className="text-sm">
              <span className="mr-1.5 text-xs font-medium text-success">Do</span>
              {yes}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="mr-1.5 text-xs font-medium text-destructive">Don&apos;t</span>
              {no}
            </p>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        Write the words first, then lay out the screen. Edit these rules to match your
        product&apos;s voice; they are the contract AI tools follow when writing UI copy.
      </p>
    </div>
  );
}
