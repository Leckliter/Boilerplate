import { describe, expect, it } from 'vitest';

import en from './en.json';
import es from './es.json';

/** Every dotted key path in a messages file: "nav.users", "palette.groups.tag" … */
function keysOf(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keysOf(v, prefix ? `${prefix}.${k}` : k));
}

/** The {placeholders} a message uses, sorted: "Hello {name}" → ["name"]. */
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

function valueAt(tree: unknown, path: string): string {
  return path
    .split('.')
    .reduce<unknown>((node, k) => (node as Record<string, unknown>)[k], tree) as string;
}

describe('messages', () => {
  const enKeys = keysOf(en).sort();
  const esKeys = keysOf(es).sort();

  it('Spanish has exactly the English keys', () => {
    expect(
      esKeys.filter((k) => !enKeys.includes(k)),
      'only in es.json',
    ).toEqual([]);
    expect(
      enKeys.filter((k) => !esKeys.includes(k)),
      'missing from es.json',
    ).toEqual([]);
  });

  it('no translation is empty', () => {
    for (const k of esKeys) expect(valueAt(es, k).trim(), k).not.toBe('');
  });

  it('every translation keeps the same {placeholders}', () => {
    for (const k of enKeys)
      expect(placeholders(valueAt(es, k)), k).toEqual(placeholders(valueAt(en, k)));
  });
});
