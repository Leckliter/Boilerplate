import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Route tests: call the route handlers (`GET` / `POST` of app/api/**) directly with Web `Request`s
 * against a real local Postgres — no browser, no `next dev`. Run with `pnpm --filter web test`.
 * Browser tests are e2e/ (Playwright, `pnpm --filter web e2e`).
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: '@/', replacement: here('./') },
      // `server-only` throws outside Next's server bundle; tests are server code.
      { find: 'server-only', replacement: here('./test/stubs/server-only.ts') },
    ],
  },
  test: {
    include: ['test/**/*.test.ts', 'lib/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    setupFiles: ['test/setup.ts'],
    // One shared database: run files one after another.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
