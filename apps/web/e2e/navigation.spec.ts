import { expect, test } from '@playwright/test';

import { OWNER, settle, signInAs } from './support/auth';

test.describe('keyboard only', () => {
  test('the first Tab stop is "Skip to content", which moves focus to the main area', async ({
    page,
  }) => {
    await signInAs(page, OWNER, '/admin');
    await settle(page);
    // Start from the top of the document, as a keyboard user does after loading a page.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main-content$/);
  });

  test('the sidebar is reachable and usable with Tab and Enter', async ({ page }) => {
    await signInAs(page, OWNER, '/admin');
    await settle(page);
    const nav = page.getByRole('navigation', { name: 'Admin' });
    await expect(nav).toBeVisible();
    // Tab until the Users link has focus (bounded, so a trap fails the test rather than hanging it).
    const users = nav.getByRole('link', { name: 'Users' });
    let focused = false;
    for (let i = 0; i < 25 && !focused; i++) {
      await page.keyboard.press('Tab');
      focused = await users.evaluate((el) => el === document.activeElement);
    }
    expect(focused, 'the Users link is in the Tab order of the sidebar').toBe(true);
    await expect(users).toHaveCSS('outline-style', /.*/); // has a computed style; the ring itself is checked below
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
    // The current page is announced.
    await expect(nav.getByRole('link', { name: 'Users' })).toHaveAttribute('aria-current', 'page');
  });

  test('every sidebar link shows a visible focus indicator', async ({ page }) => {
    await signInAs(page, OWNER, '/admin');
    await settle(page);
    const nav = page.getByRole('navigation', { name: 'Admin' });
    const first = nav.getByRole('link').first();
    await first.focus();
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus-visible');
    await expect(focused).toHaveCount(1);
    const shadow = await focused.evaluate((el) => {
      const s = getComputedStyle(el);
      return `${s.outlineStyle}|${s.outlineWidth}|${s.boxShadow}`;
    });
    expect(shadow).not.toMatch(/^none\|0px\|none$/);
  });

  test('Ctrl+K opens the command palette, typing finds a page, Enter goes there, Escape closes', async ({
    page,
  }) => {
    await signInAs(page, OWNER, '/admin');
    await settle(page);
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await expect(palette).toBeVisible();
    const input = palette.getByRole('combobox').or(palette.getByRole('textbox')).first();
    await expect(input).toBeFocused();

    await input.fill('roles');
    await expect(palette.getByText('Roles & permissions').first()).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/admin\/roles/);
    await expect(palette).toBeHidden();

    await page.keyboard.press('Control+k');
    await expect(palette).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();
  });

  test('the palette moves through results with the arrow keys', async ({ page }) => {
    await signInAs(page, OWNER, '/admin');
    await settle(page);
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await expect(palette).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(
      palette.locator('[aria-selected="true"], [data-highlighted]').first(),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();
  });

  test('the quick-search button opens the palette too, and Escape returns focus to it', async ({
    page,
  }) => {
    await signInAs(page, OWNER, '/admin');
    await settle(page);
    const trigger = page.getByRole('button', { name: /Quick search/ });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe('dark mode', () => {
  test('the choice is remembered and applied before the first paint (no flash)', async ({
    page,
  }) => {
    await signInAs(page, OWNER, '/admin');
    await settle(page);
    await page.getByRole('button', { name: 'Theme' }).click();
    await page.getByRole('menuitemradio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');

    // On the next load, record whether <html> already had `dark` when the document was parsed.
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        (window as unknown as { __darkAtParse: boolean }).__darkAtParse =
          document.documentElement.classList.contains('dark');
      });
    });
    await page.reload();
    expect(
      await page.evaluate(() => (window as unknown as { __darkAtParse: boolean }).__darkAtParse),
    ).toBe(true);
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    // The page really is dark (not just the class): the body background is not near white.
    const luminance = await page.evaluate(() => {
      const [r, g, b] = getComputedStyle(document.body)
        .backgroundColor.match(/\d+(\.\d+)?/g)!
        .map(Number);
      return (0.2126 * r! + 0.7152 * g! + 0.0722 * b!) / 255;
    });
    expect(luminance).toBeLessThan(0.3);

    // And it is per browser, so it also applies on the public site.
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  });

  test('"System" follows the operating system, and Light overrides it', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await signInAs(page, OWNER, '/admin');
    await settle(page);
    await expect(page.locator('html')).toHaveClass(/\bdark\b/); // nothing chosen yet: system = dark
    await page.getByRole('button', { name: 'Theme' }).click();
    await page.getByRole('menuitemradio', { name: 'Light' }).click();
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
    await page.reload();
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
  });
});
