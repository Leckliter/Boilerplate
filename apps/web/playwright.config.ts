import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end smoke tests against a built app:
 *   pnpm --filter web build && pnpm --filter web e2e
 * Needs DATABASE_URL (a migrated local Postgres). Runs `next start` on port 3100 unless E2E_BASE_URL is set.
 */
const port = 3100;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH && {
      launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH },
    }),
  },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm start --port ${port}`,
        url: `${baseURL}/api/healthcheck`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
