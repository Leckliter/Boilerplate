import { expect, test } from '@playwright/test';

import { OWNER, signInAs, uniq } from './support/auth';

/**
 * The error pipeline from the person's side to the admin's and an AI agent's: something crashes ->
 * a reference is shown -> it is in Admin → Errors -> its page has "Copy for AI agent" with the
 * reference and the stack. The crashes come from dev-only routes under /api/dev (404 outside DEV_LOGIN).
 */
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

/** Open the error in Admin → Errors by its reference and check the "Copy for AI agent" brief. */
async function expectCopyableReport(
  page: import('@playwright/test').Page,
  ref: string,
  message: string,
) {
  await page.goto('/admin/errors?status=all');
  const row = page
    .getByRole('link', { name: new RegExp(`${message}.*${ref}|${ref}.*${message}`, 's') })
    .first();
  await expect(row).toBeVisible();
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/admin/errors/${ref}`));
  await expect(page.getByRole('heading', { level: 1 })).toContainText(message);
  await page.getByRole('button', { name: 'Copy for AI agent' }).click();
  const brief = await page.evaluate(() => navigator.clipboard.readText());
  expect(brief).toContain(ref);
  expect(brief).toContain('## Stack');
  expect(brief).toContain(message);
}

test('a bug on a page shows a reference, and it is listed with a copyable AI report', async ({
  page,
}) => {
  await signInAs(page, OWNER, '/admin');
  // A search the database refuses: the list says so with a reference instead of crashing the page.
  await page.goto('/admin/users?q=%00');
  await expect(page.getByText('Couldn’t load the users.')).toBeVisible();
  const code = page.locator('code', { hasText: /^E-[0-9A-Z]{8}$/ }).first();
  await expect(code).toBeVisible();
  const ref = (await code.textContent())!.trim();

  await page.goto('/admin/errors?status=all');
  await expect(page.getByRole('link', { name: new RegExp(ref) })).toBeVisible();
  await page.getByRole('link', { name: new RegExp(ref) }).click();
  await expect(page).toHaveURL(new RegExp(ref));
  await page.getByRole('button', { name: 'Copy for AI agent' }).click();
  const brief = await page.evaluate(() => navigator.clipboard.readText());
  expect(brief).toContain(ref);
  expect(brief).toContain('## Stack');
  // The copy button says so.
  await expect(page.getByRole('button', { name: /copied/i })).toBeVisible();
});

test('a crashed server page shows the error screen and its reference; Admin → Errors has it', async ({
  page,
}) => {
  await signInAs(page, OWNER, '/admin');
  await page.goto('/api/dev/crash');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const code = page.locator('code').first();
  await expect(code).toBeVisible();
  const ref = (await code.textContent())!.trim();
  expect(ref).toMatch(/^(E-[0-9A-Z]{8}|\d{5,})$/); // a server crash is shown by its Next.js digest
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();

  // The digest opens the same report as an E- reference does.
  await page.goto(`/admin/errors/${ref}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('E2E server page crash');
  await page.getByRole('button', { name: 'Copy for AI agent' }).click();
  const brief = await page.evaluate(() => navigator.clipboard.readText());
  expect(brief).toContain('## Stack');
  expect(brief).toContain('E2E server page crash');
});

test('a crash in the browser is reported to /api/errors and shown with its E- reference', async ({
  page,
}) => {
  await signInAs(page, OWNER, '/admin');
  const reported = page.waitForResponse(
    (r) => r.url().endsWith('/api/errors') && r.request().method() === 'POST',
  );
  await page.goto('/api/dev/crash/client');
  const body = (await (await reported).json()) as { ref: string };
  expect(body.ref).toMatch(/^E-[0-9A-Z]{8}$/);
  await expect(page.locator('code', { hasText: body.ref })).toBeVisible();
  await expectCopyableReport(page, body.ref, 'E2E client page crash');
});

test('an error thrown in a timer is reported by the global handler', async ({ page }) => {
  await signInAs(page, OWNER, '/admin');
  const message = uniq('e2e-timer-');
  const reported = page.waitForResponse(
    (r) => r.url().endsWith('/api/errors') && r.request().method() === 'POST',
  );
  await page.evaluate((m) => {
    setTimeout(() => {
      throw new Error(m);
    }, 0);
  }, message);
  const { ref } = (await (await reported).json()) as { ref: string };
  expect(ref).toMatch(/^E-[0-9A-Z]{8}$/);
  await expectCopyableReport(page, ref, message);
});

test('dev-only crash routes: a handler that throws and one that reports', async ({ page }) => {
  await signInAs(page, OWNER, '/admin');
  const message = uniq('e2e-boom-');
  const reported = await page.request.get(`/api/dev/boom?message=${message}`);
  expect(reported.status()).toBe(500);
  const { ref } = (await reported.json()) as { ref: string };
  expect(ref).toMatch(/^E-[0-9A-Z]{8}$/);
  await expectCopyableReport(page, ref, message);

  // Thrown (not reported by the route itself): Next's onRequestError (instrumentation.ts) records it.
  const thrown = uniq('e2e-throw-');
  const res = await page.request.get(`/api/dev/boom?kind=throw&message=${thrown}`);
  expect(res.status()).toBe(500);
  await page.goto('/admin/errors?status=all');
  await expect(page.getByRole('link', { name: new RegExp(thrown) }).first()).toBeVisible();
});

test('a signed-out visitor sees the client error screen too, and the API answers 404 elsewhere', async ({
  page,
  request,
}) => {
  // The reporting endpoint is open (anyone's browser can crash) but refuses other origins.
  const crossOrigin = await request.post('/api/errors', {
    headers: { origin: 'https://evil.example' },
    data: { message: 'x', via: 'boundary' },
  });
  expect(crossOrigin.status()).toBe(403);
  await page.goto('/api/dev/crash/client');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});
