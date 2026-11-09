import { expect, type Page, test } from '@playwright/test';

import { CUSTOMER, OWNER, settle, signInAs, uniq } from './support/auth';

/**
 * The flows a person actually does, end to end: the public forms, the admin's bulk and import tools,
 * search, notifications, privacy, feature flags and the welcome wizard. Each test makes its own records
 * (`uniq`) because the specs share one database and run in parallel.
 */

async function createUser(page: Page, first: string, last: string, email: string) {
  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'New user' }).click();
  const dialog = page.getByRole('dialog', { name: 'New user' });
  await dialog.getByLabel('First name').fill(first);
  await dialog.getByLabel('Last name').fill(last);
  await dialog.getByLabel('Email').fill(email);
  await dialog.getByRole('button', { name: 'Create user' }).click();
  await expect(dialog).toBeHidden();
}

test.describe('public forms', () => {
  test('the contact form sends a message that shows up in the admin inbox', async ({ page }) => {
    const name = uniq('Visitor');
    const email = `${name.toLowerCase()}@example.com`;
    const message = `Do you open on Sundays? ${name}`;
    await page.goto('/contact');
    await page.getByLabel('Your name').fill(name);
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Subject').fill('Opening hours');
    await page.getByLabel('Message').fill(message);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText('Thanks, we got your message.')).toBeVisible();
    await expect(page.getByLabel('Your name')).toHaveCount(0);

    // Staff see it, and the sender became a contact.
    await signInAs(page, OWNER, `/admin/inquiries?q=${name}`);
    await settle(page);
    await expect(page.getByText(name).first()).toBeVisible();
    await page
      .getByRole('link', { name: new RegExp(`Opening hours|${name}`) })
      .first()
      .click();
    await expect(page.getByText(message)).toBeVisible();
    await page.goto(`/admin/users?q=${name}`);
    await expect(page.getByRole('link', { name: new RegExp(name) }).first()).toBeVisible();
  });

  test('the contact form explains a missing field instead of failing', async ({ page }) => {
    await page.goto('/contact');
    await page
      .getByRole('main')
      .locator('form')
      .evaluate((f: HTMLFormElement) => (f.noValidate = true));
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    await expect(page.getByText('Thanks, we got your message.')).toHaveCount(0);
  });

  test('the footer newsletter form asks for confirmation (double opt-in) and makes a lead', async ({
    page,
  }) => {
    const handle = uniq('news');
    await page.goto('/');
    await page.getByLabel('Email address').fill(`${handle}@example.com`);
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await expect(
      page.getByText('Almost there: check your email and confirm to join.'),
    ).toBeVisible();
    // Nobody is subscribed yet, but the address is a contact (a lead) staff can see.
    await signInAs(page, OWNER, `/admin/users?q=${handle}`);
    await settle(page);
    await expect(page.getByText(`${handle}@example.com`).first()).toBeVisible();
  });

  test('a newsletter confirm link with a bad token says so, and the landing pages exist', async ({
    page,
  }) => {
    await page.goto('/api/v1/newsletter/confirm?t=garbage-token-garbage');
    await page.getByRole('button', { name: 'Yes, subscribe me' }).click();
    await expect(page.getByRole('heading', { name: 'That link isn’t valid' })).toBeVisible();
    await page.goto('/newsletter/confirmed');
    await expect(page.getByRole('heading', { name: 'You’re subscribed' })).toBeVisible();
    await page.goto('/newsletter/unsubscribed');
    await expect(page.getByRole('heading', { name: 'You’re unsubscribed' })).toBeVisible();
  });
});

test.describe('admin tools', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, OWNER, '/admin/users');
  });

  test('bulk archive asks first, cancelling keeps people, confirming archives them', async ({
    page,
  }) => {
    const tag = uniq('Bulk');
    await createUser(page, 'Ann', `${tag}A`, `${tag.toLowerCase()}a@example.com`);
    await createUser(page, 'Ben', `${tag}B`, `${tag.toLowerCase()}b@example.com`);
    await page.goto(`/admin/users?q=${tag}`);
    await settle(page);
    const table = page.getByRole('table', { name: 'Users' });
    await expect(table.getByRole('link', { name: new RegExp(tag) })).toHaveCount(2);

    await table.getByRole('checkbox', { name: /Select all rows/ }).check();
    await expect(page.locator('span', { hasText: /^2 selected$/ })).toBeVisible();
    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    const dialog = page
      .getByRole('alertdialog')
      .or(page.getByRole('dialog', { name: /Archive 2 users/ }));
    await expect(dialog).toContainText('Archive 2 users?');

    // Cancel: nothing changes.
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(table.getByRole('link', { name: new RegExp(tag) })).toHaveCount(2);

    // Confirm: both are archived and leave the list.
    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    await dialog.getByRole('button', { name: 'Archive', exact: true }).click();
    await expect(page.getByText('Archived', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: new RegExp(tag) })).toHaveCount(0);
  });

  test('CSV import: the check lists what would be skipped and saves nothing; Import then creates', async ({
    page,
  }) => {
    const tag = uniq('Csv');
    const good = `${tag.toLowerCase()}-ok@example.com`;
    const csv = [
      'first_name,last_name,email',
      `Cleo,${tag},${good}`,
      `Dup,${tag},${good}`,
      `Bad,${tag},not-an-email`,
    ].join('\n');
    await page.getByRole('button', { name: 'Import CSV' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Or paste CSV text').fill(csv);
    await dialog.getByRole('button', { name: 'Check the file' }).click();
    await expect(dialog.getByText(/3 rows in the file: 1 will be imported/)).toBeVisible();
    await expect(dialog.getByRole('table', { name: 'Rows that will be skipped' })).toContainText(
      'Duplicate',
    );
    await expect(dialog.getByRole('table', { name: 'Rows that will be skipped' })).toContainText(
      'Invalid',
    );

    // A dry run saves nothing.
    await page.keyboard.press('Escape');
    await page.goto(`/admin/users?q=${tag}`);
    await settle(page);
    await expect(page.getByRole('link', { name: new RegExp(tag) })).toHaveCount(0);

    // The real import creates the one good row.
    await page.getByRole('button', { name: 'Import CSV' }).click();
    const again = page.getByRole('dialog');
    await again.getByLabel('Or paste CSV text').fill(csv);
    await again.getByRole('button', { name: 'Check the file' }).click();
    await again.getByRole('button', { name: 'Import 1 user' }).click();
    await expect(page.getByRole('link', { name: new RegExp(`Cleo ${tag}`) }).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('the command palette finds a person by name and opens their record', async ({ page }) => {
    const tag = uniq('Palette');
    await createUser(page, 'Pia', tag, `${tag.toLowerCase()}@example.com`);
    await page.goto('/admin');
    await settle(page);
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await expect(palette).toBeVisible();
    await palette.getByRole('combobox').or(palette.getByRole('textbox')).first().fill(tag);
    const hit = palette.getByText(new RegExp(`Pia ${tag}`)).first();
    await expect(hit).toBeVisible({ timeout: 15_000 });
    await hit.click();
    await expect(page).toHaveURL(/\/admin\/users\/[0-9a-f-]{36}/);
    await expect(
      page.getByRole('heading', { name: new RegExp(`Pia ${tag}`) }).first(),
    ).toBeVisible();
  });

  test('a feature flag is switched on, saved, and survives a reload', async ({ page }) => {
    await page.goto('/admin/settings?tab=flags');
    await settle(page);
    const card = page.locator('[data-slot="card"]').filter({ hasText: 'holiday-banner' }).first();
    const toggle = card.getByRole('switch', { name: 'Turned on' });
    const start = (await toggle.getAttribute('aria-checked')) === 'true';
    await toggle.click();
    await card.getByRole('button', { name: /Save/ }).click();
    await expect(page.getByText('Saved holiday-banner')).toBeVisible();
    await page.reload();
    await settle(page);
    const after = page
      .locator('[data-slot="card"]')
      .filter({ hasText: 'holiday-banner' })
      .first()
      .getByRole('switch', { name: 'Turned on' });
    await expect(after).toHaveAttribute('aria-checked', String(!start));
    // Put it back so the spec leaves the flag as it found it.
    await after.click();
    await page
      .locator('[data-slot="card"]')
      .filter({ hasText: 'holiday-banner' })
      .first()
      .getByRole('button', { name: /Save/ })
      .click();
    await expect(page.getByText('Saved holiday-banner')).toBeVisible();
  });

  test('"Add setting" opens a working form and saves a setting', async ({ page }) => {
    const key = `e2e.${uniq('setting')}`;
    await page.goto('/admin/settings?tab=all');
    await settle(page);
    await page.getByRole('button', { name: 'Add setting' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add or change a setting' });
    await dialog.getByLabel('Key').fill(key);
    await dialog.getByLabel('Value (JSON)').fill('"hello"');
    await dialog.getByRole('button', { name: 'Save setting' }).click();
    await expect(page.getByText('Setting saved')).toBeVisible();
    await expect(page.getByText(key)).toBeVisible();
  });

  test('forms say what is wrong instead of failing: a setting with an invalid key, an API key with no name', async ({
    page,
  }) => {
    await page.goto('/admin/settings?tab=all');
    await settle(page);
    await page.getByRole('button', { name: 'Add setting' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add or change a setting' });
    await dialog.locator('form').evaluate((f: HTMLFormElement) => (f.noValidate = true));
    await dialog.getByLabel('Key').fill('no spaces allowed here');
    await dialog.getByRole('button', { name: 'Save setting' }).click();
    await expect(dialog.getByRole('alert').first()).toBeVisible();
    await expect(dialog.getByText('Error reference')).toHaveCount(0);
    await expect(page.getByText('Setting saved')).toHaveCount(0);

    await page.goto('/admin/api-keys');
    await settle(page);
    await page.getByRole('button', { name: 'New API key' }).first().click();
    const keyDialog = page.getByRole('dialog', { name: /API key/ });
    await keyDialog.locator('form').evaluate((f: HTMLFormElement) => (f.noValidate = true));
    await keyDialog.getByRole('button', { name: 'Create key' }).click();
    await expect(keyDialog.getByRole('alert').first()).toBeVisible();
    await expect(keyDialog.getByText('Error reference')).toHaveCount(0);
  });

  test('the welcome wizard walks through its steps and finishes', async ({ page }) => {
    await page.goto('/admin?welcome=1');
    const wizard = page.getByRole('dialog', { name: /^Welcome to/ });
    await expect(wizard).toBeVisible();
    await expect(wizard.getByRole('list', { name: 'Progress' })).toBeVisible();
    await expect(wizard.getByRole('button', { name: 'Back', exact: true })).toBeDisabled();
    for (const step of ['Brand', 'Team', 'Services']) {
      await wizard.getByRole('button', { name: 'Next' }).click();
      await expect(wizard.getByRole('heading', { name: new RegExp(`${step}$`) })).toBeVisible();
    }
    await wizard.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(wizard.getByRole('heading', { name: /Team$/ })).toBeVisible();
    await wizard.getByRole('button', { name: 'Next' }).click();
    await wizard.getByRole('button', { name: 'Start exploring' }).click();
    await expect(wizard).toBeHidden();
  });
});

test.describe('notifications and privacy', () => {
  test('the bell shows an unread test message and "Mark as read" clears it', async ({ page }) => {
    await signInAs(page, `${uniq('bell')}@example.com`, '/account/notifications?tab=settings');
    await settle(page);
    await page.getByRole('button', { name: 'Send me a test' }).click();
    await expect(page.getByText('Test sent.')).toBeVisible();
    const bell = page.getByRole('button', { name: /^Notifications, \d+ unread$/ });
    await expect(bell).toBeVisible({ timeout: 20_000 });
    await bell.click();
    const list = page.getByRole('region', { name: 'Notifications' });
    await expect(list.getByText(/\d+ unread/)).toBeVisible();
    await list.getByRole('button', { name: 'Mark as read' }).first().click();
    await expect(list.getByText('No unread')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible();
  });

  test('deleting an account is scheduled after typing your email, and can be cancelled', async ({
    page,
  }) => {
    const email = `${uniq('gone')}@example.com`;
    await signInAs(page, email, '/account/privacy');
    await settle(page);
    await page.getByRole('button', { name: 'Delete my account' }).click();
    const dialog = page.getByRole('dialog').or(page.getByRole('alertdialog')).last();
    await dialog.getByLabel(new RegExp(`Type ${email}`)).fill('someone-else@example.com');
    await dialog.getByRole('button', { name: 'Delete my account' }).click();
    await expect(dialog.getByText('That isn’t your email address.')).toBeVisible();
    await dialog.getByLabel(new RegExp(`Type ${email}`)).fill(email);
    await dialog.getByRole('button', { name: 'Delete my account' }).click();
    await expect(page.getByText('Deletion scheduled')).toBeVisible();
    await expect(page.getByText(/scheduled to be deleted on/)).toBeVisible();

    await page.getByRole('button', { name: 'Keep my account' }).click();
    await expect(page.getByText('Deletion cancelled')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete my account' })).toBeVisible();
  });
});

test.describe('push notifications (a mocked browser)', () => {
  /** A browser with push support, a chosen permission, and a fake service worker + subscription. */
  async function mockPush(
    page: Page,
    permission: 'default' | 'granted' | 'denied',
    configured = true,
  ) {
    await page.route('**/api/push/public-key', (route) =>
      route.fulfill({
        json: configured
          ? {
              configured: true,
              publicKey:
                'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
            }
          : { configured: false, publicKey: null },
      }),
    );
    await page.addInitScript((initial) => {
      let granted = initial === 'granted';
      let denied = initial === 'denied';
      let subscription: unknown = null;
      Object.defineProperty(window, 'PushManager', { value: class {}, configurable: true });
      Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: class {
          static get permission() {
            return denied ? 'denied' : granted ? 'granted' : 'default';
          }
          static requestPermission = async () => {
            if (!denied) granted = true;
            return denied ? 'denied' : 'granted';
          };
        },
      });
      const key = (bytes: number[]) => new Uint8Array(bytes).buffer;
      const makeSub = () => ({
        endpoint: 'https://push.example.test/send/abc123',
        getKey: (name: string) =>
          key(
            name === 'auth'
              ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
              : Array.from({ length: 65 }, (_, i) => i + 1),
          ),
        unsubscribe: async () => {
          subscription = null;
          return true;
        },
      });
      const registration = {
        pushManager: {
          getSubscription: async () => subscription,
          subscribe: async () => (subscription = makeSub()),
        },
      };
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
          getRegistration: async () => registration,
          register: async () => registration,
          ready: Promise.resolve(registration),
        },
      });
    }, permission);
  }

  const settingsUrl = '/account/notifications?tab=settings';

  test('a browser without push support says what to do instead', async ({ page }) => {
    await page.addInitScript(() => {
      delete (window as unknown as { PushManager?: unknown }).PushManager;
    });
    await signInAs(page, CUSTOMER, settingsUrl);
    await settle(page);
    await expect(page.getByText('This browser can’t receive push notifications.')).toBeVisible();
  });

  test('a site without VAPID keys says push is not set up', async ({ page }) => {
    await mockPush(page, 'default', false);
    await signInAs(page, CUSTOMER, settingsUrl);
    await settle(page);
    await expect(
      page.getByText('Push notifications aren’t set up on this site yet.'),
    ).toBeVisible();
  });

  test('blocked notifications explain how to allow them', async ({ page }) => {
    await mockPush(page, 'denied');
    await signInAs(page, CUSTOMER, settingsUrl);
    await settle(page);
    await expect(
      page.getByText('Notifications are blocked for this site in your browser.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Turn on for this device' })).toHaveCount(0);
  });

  test('turning push on and off for this device', async ({ page }) => {
    await mockPush(page, 'default');
    await signInAs(page, `${uniq('push')}@example.com`, settingsUrl);
    await settle(page);
    await page.getByRole('button', { name: 'Turn on for this device' }).click();
    await expect(page.getByText('Push notifications are on for this device')).toBeVisible();
    await expect(page.getByText('On', { exact: true })).toBeVisible();
    await expect(page.getByText('Devices that get push notifications')).toBeVisible();
    await expect(page.getByText(/ · since /)).toBeVisible();
    await page.getByRole('button', { name: 'Turn off for this device' }).click();
    await expect(page.getByText('Push notifications are off for this device')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Turn on for this device' })).toBeVisible();
  });
});
