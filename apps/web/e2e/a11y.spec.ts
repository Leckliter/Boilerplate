import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { CUSTOMER, OWNER, settle, signInAs } from './support/auth';

/**
 * Automated accessibility scan (axe-core, WCAG 2.0/2.1 A and AA) of the main screens in light and dark.
 * The bar is zero serious or critical violations. `KNOWN` is the allow-list of rule ids still open on a page
 * (each with where it comes from and a TODO.md item). It is EMPTY and must stay empty: fix the cause
 * instead. (A fixed entry has to be removed, so the list can only shrink.)
 */
const KNOWN: Record<string, { rules: string[]; why: string }> = {};

type Screen = { name: string; path: string; as?: string };
const SCREENS: Screen[] = [
  { name: 'home', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'brand', path: '/brand' },
  { name: 'admin dashboard', path: '/admin', as: OWNER },
  { name: 'admin users', path: '/admin/users', as: OWNER },
  { name: 'account', path: '/account', as: CUSTOMER },
];

async function scan(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // The Next.js development overlay is not our markup.
    .exclude('nextjs-portal')
    .analyze();
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`axe, ${scheme} mode`, () => {
    test.use({ colorScheme: scheme });
    for (const screen of SCREENS) {
      test(`${screen.name} has no serious or critical violations`, async ({ page }) => {
        if (screen.as) await signInAs(page, screen.as, screen.path);
        else await page.goto(screen.path);
        await settle(page);
        // Let fonts, the theme and any streamed content finish before measuring contrast.
        await page.waitForTimeout(500);
        const known = KNOWN[`${screen.path}`]?.rules ?? [];
        const violations = await scan(page);
        const fresh = violations.filter((v) => !known.includes(v.id));
        const report = fresh
          .map(
            (v) =>
              `${v.id} (${v.impact}): ${v.help}\n${v.nodes
                .slice(0, 3)
                .map((n) => `    ${n.target.join(' ')}  ${n.failureSummary?.split('\n')[1] ?? ''}`)
                .join('\n')}`,
          )
          .join('\n');
        // A string, so a failure prints the violations and not a page of JSON.
        expect(
          report,
          `serious/critical accessibility violations on ${screen.path} (${scheme})`,
        ).toBe('');
        // (colour contrast differs between light and dark, so it can be open in only one of them.)
        const fixed = known.filter(
          (id) => id !== 'color-contrast' && !violations.some((v) => v.id === id),
        );
        expect(fixed, `fixed: remove ${fixed.join(', ')} from KNOWN for ${screen.path}`).toEqual(
          [],
        );
      });
    }
  });
}
