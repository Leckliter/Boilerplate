import { expect, type Page, test } from '@playwright/test';

export const OWNER = 'owner@example.com';
export const ADMIN = 'admin@example.com';
export const STAFF = 'staff@example.com';
export const CUSTOMER = 'casey@example.com';

/**
 * Signs in through the dev-only /api/dev-login (lib/auth/dev.ts), which sets the same kind of cookie a
 * real sign-in would. Skips the test on a site where dev login is off (a production build).
 */
export async function signInAs(page: Page, email: string, next = '/account') {
  const url = `/api/dev-login?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`;
  let status = 0;
  // `next dev` answers a 500 for a moment while it recompiles after someone saves a file: try again.
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await page.request.get(url, { maxRedirects: 0 });
    status = res.status();
    if (status < 500) break;
    await page.waitForTimeout(1_500 * (attempt + 1));
  }
  test.skip(status === 404, 'DEV_LOGIN is off on this site');
  expect(status, 'dev login redirects').toBeLessThan(400);
  await page.goto(next);
  await dismissWelcome(page);
}

/**
 * The owner's one-time "Welcome" dialog (components/onboarding) on the dashboard of a database that has
 * not seen it. global-setup.ts closes it once; this catches a site where that did not run.
 */
export async function dismissWelcome(page: Page) {
  if (!new URL(page.url()).pathname.startsWith('/admin')) return;
  const welcome = page.getByRole('dialog', { name: /^Welcome to/ });
  if (await welcome.isVisible()) {
    await welcome.getByRole('button', { name: 'Close' }).click();
    await expect(welcome).toBeHidden();
  }
}

/** Wait until the page has stopped streaming its loading states. */
export async function settle(page: Page) {
  await page.waitForLoadState('load');
  // /brand shows loading states on purpose (it is the style guide of them).
  if (new URL(page.url()).pathname.startsWith('/brand')) return;
  await expect(page.getByText('Loading…', { exact: true })).toHaveCount(0);
}

export const uniq = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
