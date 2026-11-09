import { expect, test } from '@playwright/test';

import { CUSTOMER, settle, signInAs } from './support/auth';

test('My account: edit the profile in place and see it saved', async ({ page }) => {
  await signInAs(page, CUSTOMER, '/account/profile');
  await settle(page);
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Last name').fill('Customer E2E');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await expect(page.getByText('Casey Customer E2E')).toBeVisible();

  // It survives a reload (it is in the database, not on the page).
  await page.reload();
  await expect(page.getByText('Casey Customer E2E')).toBeVisible();
});

test('My account: Cancel throws the edit away', async ({ page }) => {
  await signInAs(page, CUSTOMER, '/account/profile');
  await settle(page);
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('First name').fill('Nobody');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Nobody')).toHaveCount(0);
});

test('sign out ends the session: the portal asks for a login again', async ({ page }) => {
  await signInAs(page, CUSTOMER, '/account');
  await settle(page);
  await page.getByRole('button', { name: 'My account' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/account');
  await expect(page).toHaveURL(/\/login\?next=%2Faccount/);
});
