import { expect, type Page, test } from '@playwright/test';

import { CUSTOMER, OWNER, settle, signInAs } from './support/auth';

/** docs/design-system.md: no page scrolls sideways at 320px (the narrowest phone we support). */
test.use({ viewport: { width: 320, height: 700 } });

const PUBLIC = ['/', '/login', '/pricing', '/about', '/privacy', '/terms', '/brand', '/docs'];
const ADMIN = [
  '/admin',
  '/admin/users',
  '/admin/users/new',
  '/admin/roles',
  '/admin/activity',
  '/admin/errors',
  '/admin/system',
  '/admin/settings',
  '/admin/settings/integrations',
  '/admin/api-keys',
  '/admin/automations',
  '/admin/notifications',
];
const ACCOUNT = [
  '/account',
  '/account/profile',
  '/account/security',
  '/account/notifications',
  '/account/preferences',
];

/** How many pixels the page is wider than the window, and the widest culprits if any. */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const over = document.documentElement.scrollWidth - window.innerWidth;
    const culprits: string[] = [];
    if (over > 0) {
      for (const el of document.body.querySelectorAll<HTMLElement>('*')) {
        const r = el.getBoundingClientRect();
        if (r.right > window.innerWidth + 1 && r.width > 0) {
          culprits.push(
            `${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).split(' ')[0]}` : ''} (${Math.round(r.right)}px)`,
          );
          if (culprits.length >= 4) break;
        }
      }
    }
    return { over, culprits };
  });
}

async function check(page: Page, path: string) {
  await page.goto(path);
  await settle(page);
  const { over, culprits } = await overflow(page);
  expect(over, `${path} is ${over}px wider than 320px: ${culprits.join(', ')}`).toBeLessThanOrEqual(
    0,
  );
}

test.describe('public pages', () => {
  for (const path of PUBLIC) {
    test(`no sideways scrolling at 320px on ${path}`, async ({ page }) => check(page, path));
  }
});

test.describe('admin (as the owner)', () => {
  for (const path of ADMIN) {
    test(`no sideways scrolling at 320px on ${path}`, async ({ page }) => {
      await signInAs(page, OWNER, '/admin');
      await check(page, path);
    });
  }

  test('a user record page', async ({ page }) => {
    await signInAs(page, OWNER, '/admin/users');
    await settle(page);
    const href = await page
      .locator('a[href^="/admin/users/"]:not([href$="/new"])')
      .first()
      .getAttribute('href');
    expect(href).toBeTruthy();
    await check(page, href!);
    await check(page, `${href}?tab=history`);
  });
});

test.describe('customer portal', () => {
  for (const path of ACCOUNT) {
    test(`no sideways scrolling at 320px on ${path}`, async ({ page }) => {
      await signInAs(page, CUSTOMER, '/account');
      await check(page, path);
    });
  }
});
