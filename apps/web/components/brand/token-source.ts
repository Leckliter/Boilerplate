import 'server-only';

import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Reads the design tokens straight from packages/ui/src/styles/globals.css (the single source of
 * truth) so /brand can never drift from the real values. Resolves `light-dark(a, b)` and `var(--x)`
 * for light and dark, and returns concrete colour strings per mode.
 */
export type Mode = 'light' | 'dark';
export type Token = { name: string; light: string; dark: string };

const CSS_PATH = [
  '../../packages/ui/src/styles/globals.css',
  '../../../packages/ui/src/styles/globals.css',
];

function readCss(): string | null {
  for (const rel of CSS_PATH) {
    try {
      return readFileSync(path.join(process.cwd(), rel), 'utf8');
    } catch {
      // Expected: cwd is apps/web in dev/build and the repo root in some runners; try the next path.
    }
  }
  return null;
}

function block(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return {};
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
  v = v.replace(/var\((--[\w-]+)\)/g, (_, n: string) =>
    vars[n] ? resolve(vars[n]!, mode, vars, depth + 1) : _,
  );
  return v.includes('light-dark(') || v.includes('var(') ? resolve(v, mode, vars, depth + 1) : v;
}

/** Every colour token with its resolved light and dark value, in file order. Empty if the file can't be read. */
export function readColorTokens(): { tokens: Token[]; found: boolean } {
  const css = readCss();
  if (!css) return { tokens: [], found: false };
  const root = block(css, ':root');
  const dark = { ...root, ...block(css, '.dark') };
  const tokens: Token[] = [];
  for (const name of Object.keys(root)) {
    const light = resolve(root[name]!, 'light', root);
    const darkV = resolve(dark[name]!, 'dark', dark);
    if (/^(oklch\(|transparent)/.test(light))
      tokens.push({ name: name.slice(2), light, dark: darkV });
  }
  return { tokens, found: true };
}
