const swatches = [
  ['background', 'Page canvas'],
  ['card', 'Cards, panels, inputs'],
  ['muted', 'Quiet fills'],
  ['accent', 'Hover fill'],
  ['primary', 'Brand / primary action'],
  ['foreground', 'Body text'],
  ['muted-foreground', 'Secondary text'],
  ['border', 'Lines'],
  ['destructive', 'Danger'],
  ['success', 'Success'],
  ['warning', 'Warning'],
  ['info', 'Info'],
] as const;

const brandScale = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'] as const;

/** The colour tokens and the brand ramp, live (they follow light/dark mode). Used on /brand and in the docs. */
export function ColorTokens() {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {swatches.map(([token, use]) => (
          <div key={token} className="overflow-hidden rounded-xl border border-border">
            <div className="h-14" style={{ background: `var(--${token})` }} />
            <div className="bg-card px-3 py-2">
              <code className="text-xs font-medium">{token}</code>
              <p className="text-xs text-muted-foreground">{use}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex overflow-hidden rounded-xl border border-border">
        {brandScale.map((s) => (
          <div
            key={s}
            className="flex h-14 flex-1 items-end p-1.5"
            style={{ background: `var(--brand-${s})` }}
          >
            {/* rules-ok: no-raw-colour — the showcase labels its own swatches */}
            <code className={`text-[10px] ${Number(s) >= 500 ? 'text-white' : 'text-brand-900'}`}>
              {s}
            </code>
          </div>
        ))}
      </div>
    </div>
  );
}
