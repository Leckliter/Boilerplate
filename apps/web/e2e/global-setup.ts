import { chromium, request } from '@playwright/test';

/**
 * Warms the app before the specs run. `next dev` compiles a route the first time it is asked for, which
 * can take longer than a test's patience, so each main route is requested once, signed in as the seeded
 * owner. (The database was already created, migrated and seeded by scripts/e2e-db.mjs, which the
 * webServer command runs just before starting the app.) Failures here are not fatal: a spec will say
 * what is really wrong.
 */
const ROUTES = [
  '/',
  '/login',
  '/brand',
  '/pricing',
  '/docs',
  '/admin',
  '/admin/users',
  '/admin/roles',
  '/admin/activity',
  '/admin/errors',
  '/admin/system',
  '/account',
  '/account/profile',
  '/api/healthcheck',
];

/** Pages that list records link to detail pages (`/admin/users/<id>`); warm one of each too. */
const DETAIL_PREFIXES = ['/admin/users/', '/admin/activity/', '/admin/errors/'];

type SetupConfig = {
  projects: { use: { baseURL?: string; launchOptions?: Parameters<typeof chromium.launch>[0] } }[];
};

export default async function globalSetup(config: SetupConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) return;
  const api = await request.newContext({ baseURL, timeout: 180_000 });
  try {
    const login = await api.get('/api/dev-login?email=owner@example.com&next=/admin', {
      maxRedirects: 0,
    });
    // On a site without dev login only the public routes are worth warming.
    const routes =
      login.status() === 404 ? ROUTES.filter((r) => !/^\/(admin|account)/.test(r)) : ROUTES;
    for (const route of routes) {
      try {
        const res = await api.get(route);
        const html = await res.text();
        for (const prefix of DETAIL_PREFIXES) {
          const href = new RegExp(`href="(${prefix}[^"?#]+)"`).exec(html)?.[1];
          if (href && href !== '/admin/users/new') {
            await api.get(href);
            if (prefix === '/admin/users/') await api.get(`${href}?tab=history`);
          }
        }
      } catch (err) {
        // Expected on a slow machine: not fatal, the specs report what is really wrong.
        console.warn(`warm-up: ${route} failed (${err instanceof Error ? err.message : err})`);
      }
    }
  } finally {
    await api.dispose();
  }
  await dismissWelcome(baseURL, config.projects[0]?.use.launchOptions);
}

/**
 * The owner's first visit to the dashboard opens a one-time "Welcome" dialog (components/onboarding) that
 * makes the rest of the page inert until it is closed; closing it saves `onboarding.done` so it never
 * shows again. Close it once here, so no spec has to.
 */
async function dismissWelcome(
  baseURL: string,
  launchOptions: SetupConfig['projects'][0]['use']['launchOptions'],
) {
  const browser = await chromium.launch(launchOptions);
  try {
    const page = await (await browser.newContext({ baseURL })).newPage();
    const login = await page.request.get('/api/dev-login?email=owner@example.com&next=/admin', {
      maxRedirects: 0,
    });
    if (login.status() === 404) return; // no dev login on this site: nothing to dismiss
    await page.goto('/admin');
    const welcome = page.getByRole('dialog', { name: /^Welcome to/ });
    try {
      await welcome.waitFor({ state: 'visible', timeout: 20_000 });
    } catch {
      // Expected: already seen (a kept database), or the dialog is not part of this app.
      return;
    }
    await welcome.getByRole('button', { name: 'Close' }).click();
    await welcome.waitFor({ state: 'hidden', timeout: 20_000 });
    console.log('global setup: closed the owner welcome dialog');
  } finally {
    await browser.close();
  }
}
