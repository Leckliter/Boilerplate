/**
 * Browser side of error reporting: send a crash to /api/errors and get back
 * the reference to show. Server crashes (errors with a `digest`) were already
 * reported on the server, so their digest is the reference.
 */
import { isStaleDeploy, promptReload } from './stale-deploy';

/** Where it was caught; `fetch` = a background request the page handled (e.g. the header's sign-in check). */
type Via = 'boundary' | 'global-error' | 'window.error' | 'unhandledrejection' | 'fetch';

const sent = new Map<string, Promise<string | null>>();
const MAX_PER_PAGE = 5;

export function reportClientError(
  error: unknown,
  via: Via,
  componentStack?: string,
): Promise<string | null> {
  const digest =
    typeof error === 'object' && error !== null && 'digest' in error
      ? String((error as { digest: unknown }).digest)
      : null;
  if (digest) return Promise.resolve(digest);
  // An old tab after a deploy: reload, nothing to fix (lib/stale-deploy.ts).
  if (isStaleDeploy(error)) {
    promptReload();
    return Promise.resolve(null);
  }

  const err = error instanceof Error ? error : new Error(String(error));
  const key = `${err.name}: ${err.message}`;
  const already = sent.get(key);
  if (already) return already;
  if (sent.size >= MAX_PER_PAGE) return Promise.resolve(null);

  const report = fetch('/api/errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: err.name,
      message: err.message.slice(0, 2_000),
      stack: err.stack?.slice(0, 20_000),
      url: window.location.href,
      componentStack: componentStack?.slice(0, 10_000),
      via,
    }),
  })
    .then(async (res) => (res.ok ? ((await res.json()) as { ref: string }).ref : null))
    // The error reporter itself can't report its own failures (offline, server down): give up quietly.
    .catch(() => null);
  sent.set(key, report);
  return report;
}
