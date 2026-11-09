import { expect, test } from '@playwright/test';

import { CUSTOMER, signInAs } from './support/auth';

/** What a signed-out visitor sees, the redirects, and the API's answers when nobody is signed in. */

test('the home page renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('/brand renders the style guide', async ({ page }) => {
  await page.goto('/brand');
  await expect(page.getByRole('heading', { name: 'Brand & UI kit' })).toBeVisible();
});

test('the login page asks for an email', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByRole('button', { name: /code/i })).toBeVisible();
});

for (const path of ['/admin', '/admin/users', '/account', '/account/profile']) {
  test(`${path} sends a signed-out visitor to the login page, remembering where they were going`, async ({
    page,
  }) => {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}`));
    await expect(page.getByLabel('Email')).toBeVisible();
  });
}

test('the API answers 401 where a login is needed, as JSON', async ({ request }) => {
  const res = await request.get('/api/account', { maxRedirects: 0 });
  expect(res.status()).toBe(401);
  expect(await res.json()).toMatchObject({ ok: false, error: { code: 'unauthenticated' } });
});

test('the action API refuses a call with no key, and a wrong key', async ({ request }) => {
  const none = await request.post('/api/v1/actions/contacts.list', { data: {} });
  expect([401, 403]).toContain(none.status());
  const wrong = await request.post('/api/v1/actions/contacts.list', {
    data: {},
    headers: { authorization: 'Bearer not-a-real-key' },
  });
  expect([401, 403]).toContain(wrong.status());
  expect(await wrong.json()).toMatchObject({ ok: false });
});

test('the health check is public and says nothing secret', async ({ request }) => {
  const res = await request.get('/api/healthcheck');
  expect([200, 503]).toContain(res.status());
  const text = await res.text();
  expect(text).not.toMatch(/postgres:\/\/|password|secret/i);
});

test('sign-in through the real form (dev code), then landing in the portal', async ({ page }) => {
  await page.goto('/login?next=/account');
  const dev = await page.getByText(/Development sign-in is on/).count();
  test.skip(dev === 0, 'DEV_LOGIN is off on this site');
  await page.getByLabel('Email').fill(CUSTOMER);
  await page.getByRole('button', { name: /code/i }).click();
  await page.getByLabel(/code/i).fill('000000');
  await page.getByRole('button', { name: /sign in|verify|continue/i }).click();
  await expect(page).toHaveURL(/\/account/);
  await expect(page.getByRole('heading', { level: 1, name: /Hello, Casey/ })).toBeVisible();
});

test('a wrong code is explained, not a crash', async ({ page }) => {
  await page.goto('/login');
  test.skip((await page.getByText(/Development sign-in is on/).count()) === 0, 'DEV_LOGIN is off');
  await page.getByLabel('Email').fill(CUSTOMER);
  await page.getByRole('button', { name: /code/i }).click();
  await page.getByLabel(/code/i).fill('123456');
  await page.getByRole('button', { name: /sign in|verify|continue/i }).click();
  await expect(page.getByText(/wrong/i)).toBeVisible();
  await expect(page.getByText('Error reference')).toHaveCount(0);
});

test('a customer cannot open Admin: they are sent back to their account', async ({ page }) => {
  await signInAs(page, CUSTOMER, '/account');
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/account\?denied=1/);
  await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);
});
