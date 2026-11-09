import { expect, type Page, test } from '@playwright/test';

import { CUSTOMER, OWNER, settle, signInAs } from './support/auth';
import { watch } from './support/watch';

/**
 * "Run the app as a human would": visit every page a person can reach, open one record of every kind,
 * and fail on anything a developer would find in the browser console or the network tab: console
 * errors and warnings (hydration mismatches, React key warnings …), uncaught errors, failed requests
 * and 5xx answers. Each page also has to render a heading (not an error screen).
 */

const PUBLIC = [
  '/',
  '/about',
  '/pricing',
  '/contact',
  '/docs',
  '/terms',
  '/privacy',
  '/brand',
  '/login',
  '/newsletter/confirmed',
  '/newsletter/unsubscribed',
];

const ADMIN = [
  '/admin',
  '/admin/users',
  '/admin/users/new',
  '/admin/inquiries',
  '/admin/roles',
  '/admin/automations',
  '/admin/automations/new',
  '/admin/automations/runs',
  '/admin/notifications',
  '/admin/activity',
  '/admin/activity?kind=change&failed=1',
  '/admin/errors',
  '/admin/errors?status=resolved',
  '/admin/errors?status=all',
  '/admin/system',
  '/admin/system?status=failed',
  '/admin/api-keys',
  '/admin/settings',
  '/admin/settings?tab=flags',
  '/admin/settings?tab=integrations',
  '/admin/settings?tab=notifications',
  '/admin/settings?tab=all',
  '/admin/settings/integrations',
];

const ACCOUNT = [
  '/account',
  '/account/profile',
  '/account/security',
  '/account/notifications',
  '/account/preferences',
  '/account/privacy',
];

async function visit(page: Page, path: string) {
  const res = await page.goto(path);
  expect(res?.status(), `${path} status`).toBeLessThan(400);
  await settle(page);
  // An error screen has no h1 with the page's name; every real page has some heading.
  await expect(page.getByRole('heading').first(), `${path} renders a heading`).toBeVisible();
  await expect(
    page.getByText('Something went wrong'),
    `${path} is not an error screen`,
  ).toHaveCount(0);
}

test.describe('crawl', () => {
  test.describe.configure({ timeout: 240_000 });

  test('public pages are clean', async ({ page }) => {
    const w = watch(page);
    for (const path of PUBLIC) await visit(page, path);
    expect(w.problems, 'console / network problems').toEqual([]);
  });

  test('every admin page and one record of each kind is clean', async ({ page }) => {
    await signInAs(page, OWNER, '/admin');
    const w = watch(page);
    for (const path of ADMIN) await visit(page, path);

    // One record of each kind, found by following the links on the list pages.
    const firstHref = async (list: string, prefix: string) => {
      await page.goto(list);
      await settle(page);
      return page
        .locator(`a[href^="${prefix}"]`)
        .evaluateAll(
          (els, p) =>
            els
              .map((e) => e.getAttribute('href') ?? '')
              .find((h) => h.length > p.length && !h.endsWith('/new') && !h.includes('?')) ?? null,
          prefix,
        );
    };
    const records: string[] = [];
    const user = await firstHref('/admin/users', '/admin/users/');
    if (user) {
      for (const tab of ['', '?tab=history', '?tab=files', '?tab=notifications']) {
        records.push(`${user}${tab}`);
      }
    }
    for (const [list, prefix] of [
      ['/admin/activity', '/admin/activity/'],
      ['/admin/errors?status=all', '/admin/errors/'],
      ['/admin/inquiries', '/admin/inquiries/'],
      ['/admin/automations', '/admin/automations/'],
      ['/admin/automations/runs', '/admin/automations/runs/'],
    ] as const) {
      const href = await firstHref(list, prefix);
      if (href) records.push(href);
    }
    expect(records.length, 'found records to open').toBeGreaterThanOrEqual(2);
    for (const path of records) await visit(page, path);
    expect(w.problems, 'console / network problems').toEqual([]);
  });

  test('every account page is clean', async ({ page }) => {
    await signInAs(page, CUSTOMER, '/account');
    const w = watch(page);
    for (const path of ACCOUNT) await visit(page, path);
    expect(w.problems, 'console / network problems').toEqual([]);
  });

  test('clicking through the admin sidebar reaches every item', async ({ page }) => {
    await signInAs(page, OWNER, '/admin');
    const w = watch(page);
    const nav = page.getByRole('navigation', { name: 'Admin' });
    await expect(nav).toBeVisible();
    const hrefs = await nav
      .getByRole('link')
      .evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('href') ?? ''))]);
    expect(hrefs.length).toBeGreaterThan(8);
    for (const href of hrefs.filter((h) => h.startsWith('/admin'))) {
      const link = nav.locator(`a[href="${href}"]`).first();
      // Settings opens a submenu in the rail; the link is still there on the page after navigation.
      if (!(await link.isVisible())) await page.goto('/admin');
      await page.locator(`nav[aria-label="Admin"] a[href="${href}"]`).first().click();
      await expect(page).toHaveURL(new RegExp(`${href.replace(/\//g, '\\/')}(\\?.*)?$`));
      await settle(page);
      await expect(page.getByRole('heading').first()).toBeVisible();
    }
    expect(w.problems, 'console / network problems').toEqual([]);
  });
});
