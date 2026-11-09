import { expect, test } from '@playwright/test';

import { OWNER, settle, signInAs, uniq } from './support/auth';

/**
 * File storage against the local S3 stand-in (scripts/dev-s3.mjs, started by playwright.config.ts):
 * a document on a user, a profile picture, and the "download my data" export. The bytes really travel
 * browser → presigned PUT → storage, and come back through the signed / public links.
 */

/** A 1×1 PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

test('a document can be uploaded to a user, opened from storage, and deleted', async ({ page }) => {
  const email = `${uniq('doc')}@example.com`;
  // The staff member creates the person, then attaches a document to their record.
  const last = uniq('Doc');
  await signInAs(page, OWNER, '/admin/users');
  await page.getByRole('button', { name: 'New user' }).click();
  const dialog = page.getByRole('dialog', { name: 'New user' });
  await dialog.getByLabel('First name').fill('Dora');
  await dialog.getByLabel('Last name').fill(last);
  await dialog.getByLabel('Email').fill(email);
  await dialog.getByRole('button', { name: 'Create user' }).click();
  await expect(dialog).toBeHidden();
  await page
    .getByRole('link', { name: `Dora ${last}` })
    .first()
    .click();
  await expect(page).toHaveURL(/\/admin\/users\/[0-9a-f-]{36}/);

  await page.goto(`${new URL(page.url()).pathname}?tab=files`);
  await settle(page);
  await expect(page.getByText('No documents yet')).toBeVisible();

  const name = `${uniq('lease')}.pdf`;
  await page.locator('input[type=file]').first().setInputFiles({
    name,
    mimeType: 'application/pdf',
    buffer: PDF,
  });
  await expect(page.getByText('Uploaded 1 file.')).toBeVisible();
  await expect(page.getByText(name)).toBeVisible();

  // The "open" link is a signed URL on the storage service: the bytes we sent come back.
  const href = await page.getByRole('link', { name: `Open ${name}` }).getAttribute('href');
  expect(href).toMatch(/^http:\/\/localhost:\d+\//);
  const fetched = await page.request.get(href!);
  expect(fetched.status()).toBe(200);
  expect((await fetched.body()).toString()).toContain('%PDF-1.4');

  await page.getByRole('button', { name: `Delete ${name}` }).click();
  const confirmDialog = page
    .getByRole('alertdialog')
    .or(page.getByRole('dialog', { name: /Delete/ }));
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole('button', { name: 'Delete file' }).click();
  await expect(page.getByText('File deleted')).toBeVisible();
  await expect(page.getByText(name)).toHaveCount(0);
});

test('an upload the type check refuses is explained, not stored', async ({ page }) => {
  await signInAs(page, OWNER, '/admin/users');
  await page.locator('a[href^="/admin/users/"]').filter({ hasNotText: 'New' }).first().click();
  await expect(page).toHaveURL(/\/admin\/users\/[0-9a-f-]{36}/);
  await page.goto(`${new URL(page.url()).pathname}?tab=files`);
  await settle(page);
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello'),
    });
  // The drop zone says why (the file type is not allowed), and nothing was listed.
  await expect(page.getByText(/notes\.txt/).first()).toBeVisible();
  await expect(page.getByText('Uploaded 1 file.')).toHaveCount(0);
});

test('a profile picture is uploaded, shown from storage, and removed', async ({ page }) => {
  const email = `${uniq('pic')}@example.com`;
  await signInAs(page, email, '/account/profile');
  await settle(page);
  await expect(page.getByText('PNG, JPG or WebP, up to 5 MB.', { exact: true })).toBeVisible();

  await page.locator('input[type=file][aria-label^="Upload a picture"]').setInputFiles({
    name: 'me.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await expect(page.getByText('Photo updated')).toBeVisible();
  const img = page.locator('[data-slot="avatar-upload"] img');
  await expect(img).toBeVisible();
  const src = await img.getAttribute('src');
  expect(src).toMatch(/^(blob:|http:\/\/localhost:\d+\/)/);

  // After the refresh the saved picture comes from storage (not the local preview).
  await page.reload();
  await settle(page);
  const saved = page.locator('[data-slot="avatar-upload"] img');
  await expect(saved).toBeVisible();
  const savedSrc = (await saved.getAttribute('src'))!;
  expect(savedSrc).toMatch(/^http:\/\/localhost:\d+\//);
  const bytes = await page.request.get(savedSrc);
  expect(bytes.status()).toBe(200);
  expect(bytes.headers()['content-type']).toContain('image/png');

  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText('Photo removed')).toBeVisible();
  await expect(page.locator('[data-slot="avatar-upload"] img')).toHaveCount(0);
});

test('"Download my data" makes a file in storage that can be downloaded', async ({ page }) => {
  const email = `${uniq('export')}@example.com`;
  await signInAs(page, email, '/account/privacy');
  await settle(page);
  await page.getByRole('button', { name: 'Request a copy' }).click();
  await expect(page.getByText('Your data is ready')).toBeVisible({ timeout: 45_000 });

  const link = page.getByRole('link', { name: 'Download' });
  const href = (await link.getAttribute('href'))!;
  expect(href).toMatch(/^http:\/\/localhost:\d+\//);
  const res = await page.request.get(href);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-disposition'] ?? '').toContain('attachment');
  const body = await res.text();
  // The export is JSON about this person: their email is in it.
  expect(body).toContain(email);
  await expect(page.getByRole('button', { name: 'Make a new copy' })).toBeVisible();
});
