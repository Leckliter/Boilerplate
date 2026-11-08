import { expect, test } from '@playwright/test';

test('home renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('login page asks for an email', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Email')).toBeVisible();
});

test('/brand renders the style guide', async ({ page }) => {
  await page.goto('/brand');
  await expect(page.getByRole('heading', { name: 'Brand & UI kit' })).toBeVisible();
});

test('/admin sends signed-out visitors to login', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
});

test('the API refuses a signed-out visitor where a login is needed', async ({ request }) => {
  const res = await request.get('/api/account');
  expect([401, 404]).toContain(res.status());
});

for (const path of ['/', '/brand']) {
  test(`no sideways scrolling at 320px on ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
