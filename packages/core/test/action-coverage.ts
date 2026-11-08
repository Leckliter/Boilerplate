/**
 * Records which actions the tests actually ran, and how they ended, so
 * `pnpm actions:tests` can insist every action has a happy-path test and a
 * "not allowed" test (docs/testing.md). Loaded for every test file
 * (vitest.config.ts → setupFiles); results land in test/.action-coverage/.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { recordActionsForTests } from '../src/actions/run';

export const COVERAGE_DIR = fileURLToPath(new URL('./.action-coverage/', import.meta.url));

const file = `${COVERAGE_DIR}${process.pid}-${Math.random().toString(36).slice(2)}.jsonl`;
mkdirSync(COVERAGE_DIR, { recursive: true });

recordActionsForTests((name, result) => {
  const outcome = result.ok ? 'ok' : result.error.code;
  appendFileSync(file, `${JSON.stringify({ name, outcome })}\n`);
});
