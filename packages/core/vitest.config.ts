import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Records which actions ran and how they ended (pnpm actions:tests checks it).
    setupFiles: ['test/action-coverage.ts'],
    // Starts/uses a local Postgres and applies every migration to a fresh `app` schema.
    globalSetup: ['test/global-setup.ts'],
    // Tests share one database; run files one after another.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
