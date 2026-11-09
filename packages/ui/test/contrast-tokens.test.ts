import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { contrastRatio } from '../src/lib/color';

/**
 * Every documented text/surface pair in globals.css must reach WCAG AA (4.5:1) in light and dark.
 * The pairs mirror the contrast table on /brand (apps/web/components/brand/color-tokens.tsx).
 * A pair that cannot reach 4.5:1 must be listed in EXCEPTIONS with the reason, so a drop is a
 * deliberate decision and not an accident.
 */
type Mode = 'light' | 'dark';

const css = readFileSync(path.join(__dirname, '../src/styles/globals.css'), 'utf8');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf('\n}', start);
  const body = css.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g))
    out[m[1]!] = m[2]!.trim().replace(/\s+/g, ' ');
  return out;
}

function splitTop(args: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of args) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  parts.push(cur.trim());
  return parts;
}

function resolve(value: string, mode: Mode, vars: Record<string, string>, depth = 0): string {
  if (depth > 8) return value;
  let v = value;
  const ld = v.indexOf('light-dark(');
  if (ld >= 0) {
    let i = ld + 'light-dark('.length;
    let d = 1;
    const from = i;
    while (i < v.length && d > 0) {
      if (v[i] === '(') d++;
      if (v[i] === ')') d--;
      i++;
    }
    const [light, dark] = splitTop(v.slice(from, i - 1));
    v = v.slice(0, ld) + (mode === 'light' ? light : dark) + v.slice(i);
  }
  v = v.replace(/var\((--[\w-]+)\)/g, (m, n: string) =>
    vars[n] ? resolve(vars[n]!, mode, vars, depth + 1) : m,
  );
  return v.includes('light-dark(') || v.includes('var(') ? resolve(v, mode, vars, depth + 1) : v;
}

const root = block(':root');
const VARS: Record<Mode, Record<string, string>> = {
  light: root,
  dark: { ...root, ...block('.dark') },
};

function token(name: string, mode: Mode): string {
  const raw = VARS[mode][`--${name}`];
  if (!raw) throw new Error(`token --${name} not found`);
  return resolve(raw, mode, VARS[mode]);
}

/** [text token, surface token, label] */
const PAIRS: [string, string, string][] = [
  ['foreground', 'background', 'Body text on the page'],
  ['card-foreground', 'card', 'Text on a card'],
  ['muted-foreground', 'background', 'Secondary text on the page'],
  ['muted-foreground', 'card', 'Secondary text on a card'],
  ['muted-foreground', 'muted', 'Secondary text on a quiet fill'],
  ['muted-foreground', 'fill', 'Secondary text on a fill'],
  ['muted-foreground', 'tint', 'Secondary text on a tint'],
  ['muted-foreground', 'elevated', 'Secondary text on an elevated surface'],
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

/** "text|surface|mode" pairs that are allowed below 4.5:1, each with the reason. */
const EXCEPTIONS: Record<string, string> = {};

describe('documented text/surface pairs reach WCAG AA (4.5:1)', () => {
  for (const mode of ['light', 'dark'] as const) {
    for (const [text, surface, label] of PAIRS) {
      const key = `${text}|${surface}|${mode}`;
      it(`${mode}: ${label} (${text} on ${surface})`, () => {
        // Translucent tints are composited over the card, like the /brand table does.
        const base = token('card', mode);
        const ratio = contrastRatio(token(text, mode), token(surface, mode), base);
        expect(ratio).not.toBeNull();
        if (EXCEPTIONS[key]) return;
        expect(ratio!).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('lists no exception that already passes', () => {
    for (const key of Object.keys(EXCEPTIONS)) {
      const [text, surface, mode] = key.split('|') as [string, string, Mode];
      const ratio = contrastRatio(token(text, mode), token(surface, mode), token('card', mode))!;
      expect(ratio, `${key} now passes; remove it from EXCEPTIONS`).toBeLessThan(4.5);
    }
  });
});
