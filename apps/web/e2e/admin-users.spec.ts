import { expect, test } from '@playwright/test';

import { OWNER, signInAs, uniq } from './support/auth';

/**
 * The admin happy paths as the seeded owner, in order, on one new user: create (ActionForm), edit
 * (EditableCard), field history, roles, last-owner guard, activity with before/after. Serial because
 * each step builds on the one before; the user is brand new so parallel specs never collide with it.
 */
test.describe.configure({ mode: 'serial' });

const run = uniq('e2e');
const first = 'Ada';
const last = `Tester ${run}`;
const email = `${run}@example.com`;
let userUrl = '';

test.beforeEach(async ({ page }) => {
  await signInAs(page, OWNER, '/admin');
});

test('the admin dashboard renders', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: /Welcome back/ })).toBeVisible();
  await expect(page.getByText('Recent activity')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Users' }).first()).toBeVisible();
});

test('New user: a no is explained, a field error is shown on its field, a bug gets an E- reference', async ({
  page,
}) => {
  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'New user' }).click();
  const dialog = page.getByRole('dialog', { name: 'New user' });
  await expect(dialog).toBeVisible();

  // The browser's own validation is switched off so the server's answers are what we see.
  await dialog.locator('form').evaluate((f: HTMLFormElement) => (f.noValidate = true));

  // A blank form: a plain "no" with a clear message, and no error reference (it is not a bug).
  await dialog.getByRole('button', { name: 'Create user' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Give at least a name');
  await expect(dialog.getByText('Error reference')).toHaveCount(0);

  // A field error: shown under the field, with the form pointing at it.
  await dialog.getByLabel('First name').fill('Ada');
  await dialog.getByLabel('Email').fill('not-an-email');
  await dialog.getByRole('button', { name: 'Create user' }).click();
  await expect(dialog.getByText('Check the highlighted fields.')).toBeVisible();
  await expect(dialog.getByText('Invalid email address')).toBeVisible();
  await expect(dialog.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByText('Error reference')).toHaveCount(0);

  // A bug (not a "no"): a NUL byte passes validation and Postgres refuses it. The person gets a reference.
  await dialog.getByLabel('First name').fill('Boom\u0000');
  await dialog.getByLabel('Last name').fill(`Crash ${run}`);
  await dialog.getByLabel('Email').fill(`crash-${email}`);
  await dialog.getByLabel('Phone').fill('+18165550199');
  await dialog.getByRole('button', { name: 'Create user' }).click();
  await expect(dialog.getByText('Error reference', { exact: true })).toBeVisible();
  await expect(dialog.locator('code')).toHaveText(/^E-[0-9A-Z]{8}$/);
});

test('New user: the happy path creates a contact', async ({ page }) => {
  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'New user' }).click();
  const dialog = page.getByRole('dialog', { name: 'New user' });
  await dialog.getByLabel('First name').fill(first);
  await dialog.getByLabel('Last name').fill(last);
  await dialog.getByLabel('Email').fill(email);
  await dialog.getByLabel('Phone').fill('+18165550123');
  await dialog.getByRole('checkbox', { name: 'Customer' }).check();
  await dialog.getByRole('button', { name: 'Create user' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('User created')).toBeVisible();

  await page.getByRole('searchbox', { name: 'Search users' }).fill(run);
  // The search is applied through the URL after a short pause; click only once the list has settled.
  await expect(page).toHaveURL(new RegExp(`q=${run}`));
  const link = page.getByRole('link', { name: new RegExp(`${first} ${last}`) });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByRole('heading', { level: 1, name: `${first} ${last}` })).toBeVisible();
  userUrl = page.url();
});

test('the record page edits in place and the change shows in Field history', async ({ page }) => {
  await page.goto(userUrl);
  await page.getByRole('button', { name: 'Edit' }).first().click();
  await page.getByLabel('Company').fill('Acme E2E');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await expect(page.getByText('Acme E2E')).toBeVisible();

  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByRole('heading', { name: 'Field history' })).toBeVisible();
  await expect(page.getByText('Acme E2E').first()).toBeVisible();
});

test('roles can be granted and revoked; the last owner is protected', async ({ page }) => {
  await page.goto(userUrl);
  await page.getByLabel('Role to grant').selectOption('staff');
  await page.getByRole('button', { name: 'Grant role' }).click();
  await expect(page.getByText('Granted staff')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Revoke staff' })).toBeVisible();
  await page.getByRole('button', { name: 'Revoke staff' }).click();
  await expect(page.getByText('Removed staff')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Revoke staff' })).toHaveCount(0);

  // The seeded owner is the only owner: taking the role away must be refused with a plain message.
  await page.goto('/admin/users');
  await page.getByRole('searchbox', { name: 'Search users' }).fill('owner@example.com');
  await expect(page).toHaveURL(/q=owner/);
  await page.getByRole('link', { name: /Olivia Owner/ }).click();
  await page.getByRole('button', { name: 'Revoke owner' }).click();
  await expect(page.getByText('This is the last owner; add another owner first.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Revoke owner' })).toBeVisible();
});

test('Activity shows the change with before and after', async ({ page }) => {
  await page.goto('/admin/activity?kind=change');
  const entry = page.getByRole('link', { name: /Acme E2E|contacts?\.update|Updated/i }).first();
  await expect(entry).toBeVisible();
  await entry.click();
  await expect(page.getByRole('heading', { name: 'What changed' })).toBeVisible();
  await expect(page.getByText('Acme E2E').first()).toBeVisible();
});
