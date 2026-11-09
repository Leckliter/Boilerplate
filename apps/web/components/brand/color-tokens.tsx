import { contrastRatio, wcagLevel } from '@app/ui/lib/color';

import { readColorTokens, type Mode, type Token } from './token-source';

/** The groups, in the order shown. A token goes to the first group whose test matches. */
const GROUPS: { title: string; note: string; test: RegExp }[] = [
  {
    title: 'Brand ramp',
    note: 'The only thing to change to re-brand. --primary is brand-500 (brand-400 in dark).',
    test: /^brand-/,
  },
  {
    title: 'Surfaces',
    note: 'Lighter with elevation in dark mode; they do not invert.',
    test: /^(background|card|popover|sidebar|elevated|recessed|tint|overlay|control|fill|fill-hover|interact|inactive|inverse|contrast)$/,
  },
  {
    title: 'Text',
    note: 'Use text-foreground for body, text-muted-foreground for secondary.',
    test: /^(foreground|card-foreground|popover-foreground|sidebar-foreground|muted|muted-foreground|placeholder|link|secondary-foreground|accent-foreground)$/,
  },
  {
    title: 'Actions',
    note: 'Primary, secondary and hover fills.',
    test: /^(primary|primary-hover|primary-foreground|secondary|accent)$/,
  },
  {
    title: 'Status',
    note: 'Solid colour for text and icons, -tint for backgrounds.',
    test: /^(destructive|destructive-foreground|success|warning|info|[a-z]+-tint|banner-.*)$/,
  },
  {
    title: 'Lines',
    note: 'Hairline borders and a neutral focus ring.',
    test: /^(border|hairline|input|ring|arrow-.*|shadow-color)$/,
  },
  {
    title: 'Badges',
    note: 'Solid badge fills (text on them is white, except orange).',
    test: /^badge-/,
  },
  {
    title: 'Calendar events',
    note: 'Per event colour: solid (edge, dot), -tint (chip), -ink (chip text).',
    test: /^event-/,
  },
  { title: 'Charts', note: 'Categorical series, first is the brand.', test: /^chart-/ },
];

/** [text token, surface token, label]. The tints are translucent, so they are composited over the card. */
const PAIRS: [string, string, string][] = [
  ['foreground', 'background', 'Body text on the page'],
  ['card-foreground', 'card', 'Text on a card'],
  ['muted-foreground', 'background', 'Secondary text on the page'],
  ['muted-foreground', 'card', 'Secondary text on a card'],
  ['muted-foreground', 'muted', 'Secondary text on a quiet fill'],
  ['primary-foreground', 'primary', 'Primary button label'],
  ['primary', 'background', 'Brand-coloured text on the page'],
  ['link', 'background', 'Link text'],
  ['destructive-foreground', 'destructive', 'Destructive button label'],
  ['destructive', 'card', 'Danger text on a card'],
  ['success', 'card', 'Success text on a card'],
  ['warning', 'card', 'Warning text on a card'],
  ['info', 'card', 'Info text on a card'],
  ['destructive', 'destructive-tint', 'Danger text on its tint'],
  ['success', 'success-tint', 'Success text on its tint'],
  ['warning', 'warning-tint', 'Warning text on its tint'],
  ['info', 'info-tint', 'Info text on its tint'],
  ['badge-inverted-foreground', 'badge-inverted', 'Primary badge'],
  ['event-blue-ink', 'event-blue-tint', 'Calendar chip (blue)'],
  ['event-amber-ink', 'event-amber-tint', 'Calendar chip (amber)'],
  ['placeholder', 'control', 'Input placeholder'],
];

function Swatch({ token, mode, backdrop }: { token: Token; mode: Mode; backdrop: string }) {
  return (
    <div
      className="flex min-w-0 items-center gap-2 rounded-md p-1.5"
      style={{ background: backdrop }}
    >
      <span
        className="size-8 shrink-0 rounded-md ring-1 ring-border"
        style={{ background: token[mode] }}
      />
      <span className="min-w-0 text-[10px] leading-tight break-all text-muted-foreground">
        {mode === 'light' ? 'Light' : 'Dark'}
      </span>
    </div>
  );
}

function Ratio({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const level = wcagLevel(value);
  return (
    <span
      className={
        level === 'Fail'
          ? 'font-medium text-destructive'
          : level === 'AA large'
            ? 'text-warning'
            : 'text-foreground'
      }
    >
      <span className="tabular-nums">{value.toFixed(2)}:1</span>{' '}
      <span className="text-xs">{level}</span>
    </span>
  );
}

/** Every colour token read from globals.css, light and dark side by side, plus contrast of the real text pairs. */
export function ColorTokens() {
  const { tokens, found } = readColorTokens();
  if (!found) {
    return (
      <p className="text-sm text-muted-foreground">
        Could not read packages/ui/src/styles/globals.css from this environment.
      </p>
    );
  }
  const byName = new Map(tokens.map((t) => [t.name, t]));
  const used = new Set<string>();
  const groups = GROUPS.map((g) => {
    const list = tokens.filter((t) => !used.has(t.name) && g.test.test(t.name));
    list.forEach((t) => used.add(t.name));
    return { ...g, list };
  });
  const rest = tokens.filter((t) => !used.has(t.name));
  if (rest.length) groups.push({ title: 'Other', note: '', test: /./, list: rest });

  const ratio = (fg: string, bg: string, mode: Mode) => {
    const f = byName.get(fg)?.[mode];
    const b = byName.get(bg)?.[mode];
    const base = byName.get('card')?.[mode];
    return f && b ? contrastRatio(f, b, base) : null;
  };

  return (
    <div className="grid gap-10">
      {groups.map((g) => (
        <div key={g.title}>
          <h3 className="text-base font-semibold">{g.title}</h3>
          {g.note && <p className="mb-3 text-sm text-muted-foreground">{g.note}</p>}
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {g.list.map((t) => (
              <li key={t.name} className="min-w-0 rounded-lg border border-border bg-card p-2">
                <code
                  className="block truncate px-1 pb-1.5 text-xs font-medium"
                  title={`--${t.name}`}
                >
                  {t.name}
                </code>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['light', 'dark'] as const).map((mode) => (
                    <Swatch
                      key={mode}
                      token={t}
                      mode={mode}
                      backdrop={byName.get('card')?.[mode] ?? 'transparent'}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div>
        <h3 className="text-base font-semibold">Contrast of real pairs</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          WCAG ratios computed from the token values above (translucent tints are composited over
          the card). Body text needs 4.5:1 (AA); text of 18px or bold 14px and icons need 3:1 (AA
          large).
        </p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Contrast ratio of text and surface token pairs in light and dark mode
            </caption>
            <thead>
              <tr className="border-b border-border bg-tint text-left">
                <th scope="col" className="p-2 font-medium">
                  Pair
                </th>
                <th scope="col" className="p-2 font-medium">
                  Light
                </th>
                <th scope="col" className="p-2 font-medium">
                  Dark
                </th>
              </tr>
            </thead>
            <tbody>
              {PAIRS.map(([fg, bg, label]) => (
                <tr key={`${fg}-${bg}`} className="border-b border-hairline last:border-b-0">
                  <th scope="row" className="p-2 text-left font-normal">
                    {label}
                    <span className="block font-mono text-[11px] text-muted-foreground">
                      {fg} on {bg}
                    </span>
                  </th>
                  <td className="p-2">
                    <Ratio value={ratio(fg, bg, 'light')} />
                  </td>
                  <td className="p-2">
                    <Ratio value={ratio(fg, bg, 'dark')} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
