import type { Page } from '@playwright/test';

/**
 * Collects what a person would never see but a developer must: browser console errors and warnings,
 * uncaught page errors, failed network requests and server errors (5xx). Attach it before navigating,
 * read `problems` afterwards. Known harmless noise is filtered in one place (`IGNORED`), each with the
 * reason it is harmless.
 */
const IGNORED: { match: RegExp; why: string }[] = [
  {
    match: /Download the React DevTools/i,
    why: 'a development-only hint',
  },
  {
    match: /\[Fast Refresh\]|\[HMR\]/i,
    why: 'the dev server announcing a hot reload',
  },
];

export type Watcher = { problems: string[]; reset(): void };

export function watch(page: Page): Watcher {
  const problems: string[] = [];
  const add = (kind: string, text: string) => {
    if (IGNORED.some((i) => i.match.test(text))) return;
    problems.push(`${kind}: ${text.slice(0, 600)}`);
  };
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      add(`console.${msg.type()} (${new URL(page.url()).pathname})`, msg.text());
    }
  });
  page.on('pageerror', (err) => add(`pageerror (${new URL(page.url()).pathname})`, err.message));
  page.on('response', (res) => {
    if (res.status() >= 500) add('http', `${res.status()} ${res.request().method()} ${res.url()}`);
  });
  page.on('requestfailed', (req) => {
    const reason = req.failure()?.errorText ?? '';
    // Navigations and prefetches cancelled by the next navigation are normal.
    if (/ERR_ABORTED|cancelled/i.test(reason)) return;
    add('requestfailed', `${req.method()} ${req.url()} ${reason}`);
  });
  return { problems, reset: () => void (problems.length = 0) };
}
