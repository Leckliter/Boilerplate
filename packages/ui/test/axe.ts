import { configureAxe } from 'jest-axe';

/**
 * Accessibility check for a rendered component: `expect(await axe(container)).toHaveNoViolations()`.
 * jsdom has no layout or colours, so colour-contrast and region rules are off; everything else
 * (names, roles, ARIA validity, labels, table structure) is checked.
 */
export const axe = configureAxe({
  rules: {
    'color-contrast': { enabled: false },
    region: { enabled: false },
  },
});
