import type { Condition, ConditionMatch } from './definition';

/**
 * Templates and conditions for automations. The context a run sees:
 *
 *   event      the trigger: { id, type, data, subject, occurredAt }
 *   steps      outputs of finished steps, by step id and by index (steps.0, steps.task)
 *   run        { id, startedAt }
 *   automation { id, name }
 *   now        ISO time when the step runs
 */
export type Context = Record<string, unknown>;

const WHOLE = /^\{\{\s*([\w.-]+)\s*\}\}$/;
const ANY = /\{\{\s*([\w.-]+)\s*\}\}/g;

export function lookup(ctx: unknown, path: string): unknown {
  let value: unknown = ctx;
  for (const part of path.split('.')) {
    if (value === null || value === undefined) return undefined;
    if (Array.isArray(value) && /^\d+$/.test(part)) value = value[Number(part)];
    else if (typeof value === 'object') value = (value as Record<string, unknown>)[part];
    else return undefined;
  }
  return value;
}

/** Fill in `{{path}}` placeholders, recursively through objects and lists. */
export function render(value: unknown, ctx: Context): unknown {
  if (typeof value === 'string') {
    const whole = WHOLE.exec(value);
    if (whole) return lookup(ctx, whole[1]!) ?? null;
    return value.replace(ANY, (_, path: string) => {
      const v = lookup(ctx, path);
      if (v === undefined || v === null) return '';
      return typeof v === 'object' ? JSON.stringify(v) : String(v);
    });
  }
  if (Array.isArray(value)) return value.map((v) => render(v, ctx));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, render(v, ctx)]));
  }
  return value;
}

export const renderText = (value: string, ctx: Context) => String(render(value, ctx) ?? '');

/** Does the context satisfy every condition? Returns the first one that fails, or null. */
export function failedCondition(conditions: readonly Condition[], ctx: Context): Condition | null {
  for (const c of conditions) {
    if (!holds(c, ctx)) return c;
  }
  return null;
}

/**
 * Do the conditions hold? `all`: the first one that fails (or null when all hold).
 * `any`: null when at least one holds, else the first condition (so a reason can be shown).
 */
export function unmetCondition(
  conditions: readonly Condition[],
  match: ConditionMatch | undefined,
  ctx: Context,
): Condition | null {
  if (match !== 'any') return failedCondition(conditions, ctx);
  if (!conditions.length || conditions.some((c) => holds(c, ctx))) return null;
  return conditions[0]!;
}

function holds(c: Condition, ctx: Context): boolean {
  const actual = lookup(ctx, c.path);
  const expected = render(c.value, ctx);
  switch (c.op) {
    case 'exists':
      return actual !== undefined && actual !== null && actual !== '';
    case 'notExists':
      return actual === undefined || actual === null || actual === '';
    case 'equals':
      return same(actual, expected);
    case 'notEquals':
      return !same(actual, expected);
    case 'in':
      return Array.isArray(expected) && expected.some((e) => same(actual, e));
    case 'notIn':
      return Array.isArray(expected) && !expected.some((e) => same(actual, e));
    case 'contains':
      if (Array.isArray(actual)) return actual.some((a) => same(a, expected));
      return typeof actual === 'string' && actual.includes(String(expected ?? ''));
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const [a, b] = comparable(actual, expected);
      if (a === null || b === null) return false;
      return c.op === 'gt' ? a > b : c.op === 'gte' ? a >= b : c.op === 'lt' ? a < b : a <= b;
    }
  }
}

/** Loose equality for templates: numbers and strings compare by value, objects by JSON. */
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  if (typeof a === 'object' || typeof b === 'object')
    return JSON.stringify(a) === JSON.stringify(b);
  return String(a) === String(b);
}

/** Numbers compare as numbers; ISO dates as times. */
function comparable(a: unknown, b: unknown): [number | null, number | null] {
  const num = (v: unknown) => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '') {
      if (!Number.isNaN(Number(v))) return Number(v);
      const t = Date.parse(v);
      if (!Number.isNaN(t)) return t;
    }
    return null;
  };
  return [num(a), num(b)];
}
