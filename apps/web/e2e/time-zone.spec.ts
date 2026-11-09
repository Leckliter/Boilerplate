import { expect, test } from '@playwright/test';

import { OWNER, settle, signInAs } from './support/auth';

/**
 * A person's time zone (the `tz` cookie, Account → Preferences) applies to server-rendered pages too, not only
 * to the client components: the same activity entry shows a different clock time in another zone.
 */
test('server-rendered times follow the time zone chosen in preferences', async ({
  page,
  context,
}) => {
  await signInAs(page, OWNER, '/admin/activity');
  await settle(page);
  const entry = page
    .locator('a[href^="/admin/activity/"]')
    .filter({ hasNotText: /Activity$/ })
    .first();
  const href = (await entry.getAttribute('href'))!;
  expect(href).toMatch(/\/admin\/activity\/[0-9a-f-]{36}$/);

  const clock = async () => {
    await page.goto(href);
    await settle(page);
    // "Nov 9, 2026, 6:55 AM · Olivia Owner" in the record header.
    const text = await page
      .getByText(/\d{4}, \d{1,2}:\d{2} [AP]M/)
      .first()
      .innerText();
    return text.match(/\d{1,2}:\d{2} [AP]M/)![0];
  };

  const before = await clock();
  const url = new URL(page.url());
  // Kiritimati is UTC+14 all year; the business default (America/Chicago) is UTC-5 or -6: never the same clock hour.
  await context.addCookies([{ name: 'tz', value: 'Pacific/Kiritimati', url: url.origin }]);
  const after = await clock();
  expect(after).not.toBe(before);

  await context.clearCookies({ name: 'tz' });
  expect(await clock()).toBe(before);
});
