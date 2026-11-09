import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { chromium, defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests (docs/testing.md):
 *
 *   pnpm --filter web e2e              # starts the app itself, against a local throw-away database
 *   pnpm --filter web e2e:test-site    # the same specs against E2E_BASE_URL (a deployed test site)
 *
 * The app runs as `next dev` (not `next start`) because DEV_LOGIN only works outside a production
 * build; it is the test-only sign-in that lets the specs become the seeded owner without an inbox.
 * The database is `<DATABASE_URL name>_e2e` (or app_e2e on the local Postgres), migrated and seeded by
 * scripts/e2e-db.mjs right before the app starts; global-setup.ts then warms the dev server's routes. The dev server's output goes to `.next-e2e` so it never
 * fights a running `pnpm dev`.
 */
const port = Number(process.env.E2E_PORT ?? 3100);
const external = process.env.E2E_BASE_URL;
const baseURL = external ?? `http://localhost:${port}`;
const root = path.resolve(import.meta.dirname, '../..');

/**
 * A Chromium to launch. PLAYWRIGHT_CHROMIUM_PATH wins; otherwise Playwright's own download; otherwise any
 * Chromium already installed under PLAYWRIGHT_BROWSERS_PATH (a machine whose browser build is a little
 * older than this Playwright, such as the cloud sandbox).
 */
function chromiumPath(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (existsSync(chromium.executablePath())) return undefined;
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!dir || !existsSync(dir)) return undefined;
  for (const name of readdirSync(dir).filter((n) => /^chromium-\d+$/.test(n))) {
    const bin = path.join(dir, name, 'chrome-linux64', 'chrome');
    if (existsSync(bin)) return bin;
  }
  return undefined;
}
const executablePath = chromiumPath();

/** Same rule as scripts/e2e-db.mjs (kept inline: a config file loads in every worker, so no side effects). */
function databaseUrl() {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  if (process.env.DATABASE_URL) {
    const u = new URL(process.env.DATABASE_URL);
    if (!u.pathname.endsWith('_e2e')) u.pathname = `${u.pathname}_e2e`;
    return u.toString();
  }
  return 'postgres://postgres:postgres@localhost:5544/app_e2e';
}

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'off',
    screenshot: 'only-on-failure',
    ...(executablePath && { launchOptions: { executablePath } }),
  },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }],
  webServer: external
    ? undefined
    : {
        // The database is prepared first (create, migrate and seed: scripts/e2e-db.mjs), then the app starts on it.
        command: `node ../../scripts/e2e-db.mjs && pnpm exec next dev --port ${port}`,
        cwd: import.meta.dirname,
        // Any page that answers means the app is up (the healthcheck is 503 until the scheduled jobs have run).
        url: `${baseURL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        stdout: 'ignore',
        stderr: 'pipe',
        env: {
          ...(process.env as Record<string, string>),
          DATABASE_URL: databaseUrl(),
          BACKEND: 'neon',
          DEV_LOGIN: '1',
          NODE_ENV: 'development',
          OWNER_EMAILS: 'owner@example.com',
          NEXT_DIST_DIR: '.next-e2e',
          NEXT_TELEMETRY_DISABLED: '1',
          // Throw-away sends only: nothing leaves the machine.
          RESEND_API_KEY: '',
          QUO_API_KEY: '',
          NEXT_PUBLIC_APP_URL: baseURL,
          E2E_ROOT: root,
        },
      },
});
