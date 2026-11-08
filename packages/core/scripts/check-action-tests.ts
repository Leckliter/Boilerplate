/**
 * Every action needs at least one test where it WORKS and one where it is REFUSED
 * (docs/testing.md). Reads what the last `pnpm test` run recorded
 * (test/action-coverage.ts) and compares it with the action registry.
 *
 *   pnpm actions:tests            # check (run `pnpm test` first)
 *   pnpm actions:tests --update   # rewrite the baseline after you ADD tests
 *
 * test/untested-actions.json is a shrinking list of actions that were missing
 * tests when this check was introduced. A NEW action can't be added to it —
 * write the tests. When you add tests for a listed action, the check tells you
 * to remove it (run with --update).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { listActions } from '../src/actions/registry';

const dir = fileURLToPath(new URL('../test/.action-coverage/', import.meta.url));
const baselinePath = fileURLToPath(new URL('../test/untested-actions.json', import.meta.url));
const update = process.argv.includes('--update');

if (!existsSync(dir) || readdirSync(dir).length === 0) {
  console.error('No action-coverage record. Run `pnpm test` (the whole suite) first.');
  process.exit(1);
}

const seen = new Map<string, Set<string>>();
for (const f of readdirSync(dir)) {
  for (const line of readFileSync(`${dir}${f}`, 'utf8').split('\n')) {
    if (!line) continue;
    const { name, outcome } = JSON.parse(line) as { name: string; outcome: string };
    if (!seen.has(name)) seen.set(name, new Set());
    seen.get(name)!.add(outcome);
  }
}

type Gap = 'works' | 'refused';
const gaps: Record<string, Gap[]> = {};
for (const action of listActions()) {
  const outcomes = seen.get(action.name) ?? new Set();
  const missing: Gap[] = [];
  if (!outcomes.has('ok')) missing.push('works');
  // Public actions can't be refused; everything else must prove it refuses the wrong caller.
  if (
    action.audience !== 'public' &&
    !outcomes.has('forbidden') &&
    !outcomes.has('unauthenticated')
  ) {
    missing.push('refused');
  }
  if (missing.length) gaps[action.name] = missing;
}

let baseline: Record<string, Gap[]> = existsSync(baselinePath)
  ? JSON.parse(readFileSync(baselinePath, 'utf8'))
  : {};

if (update) {
  // Only ever shrinks: keep an entry only if it is still in the baseline AND still missing.
  const next: Record<string, Gap[]> = {};
  for (const [name, missing] of Object.entries(gaps)) {
    const allowed = baseline[name];
    if (!allowed) continue;
    const still = missing.filter((g) => allowed.includes(g));
    if (still.length) next[name] = still;
  }
  writeFileSync(baselinePath, `${JSON.stringify(sortKeys(next), null, 2)}\n`);
  const removed = Object.keys(baseline).length - Object.keys(next).length;
  console.log(`Baseline updated (${Object.keys(next).length} actions left; ${removed} removed).`);
  baseline = next;
}

const newGaps: string[] = [];
const fixed: string[] = [];
for (const [name, missing] of Object.entries(gaps)) {
  const allowed = baseline[name] ?? [];
  for (const g of missing)
    if (!allowed.includes(g))
      newGaps.push(
        `${name}: no test where it ${g === 'works' ? 'works' : 'is refused (wrong role / signed out)'}`,
      );
}
for (const [name, allowed] of Object.entries(baseline)) {
  for (const g of allowed) if (!gaps[name]?.includes(g)) fixed.push(`${name} (${g})`);
}

let failed = false;
if (newGaps.length) {
  failed = true;
  console.error(
    `✗ ${newGaps.length} action test(s) missing. Every action needs a test where it works AND one where\n` +
      '  the wrong caller is refused — usually callAction(theAction, input, await makeActor([])) expecting\n' +
      "  error.code 'forbidden' (see packages/core/test/*.test.ts and docs/testing.md):\n" +
      newGaps.map((g) => `    ${g}`).join('\n'),
  );
}
if (fixed.length && !update) {
  failed = true;
  console.error(
    `✗ These are tested now — remove them from test/untested-actions.json (pnpm actions:tests --update):\n` +
      fixed.map((g) => `    ${g}`).join('\n'),
  );
}
if (failed) process.exit(1);
const left = Object.keys(baseline).length;
console.log(
  `Action tests OK (${listActions().length} actions${left ? `; ${left} still on the untested list — add tests and shrink it` : ''}).`,
);

function sortKeys<T>(o: Record<string, T>) {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}
