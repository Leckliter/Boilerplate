import { reportClientError } from '@/lib/report-client-error';

/**
 * Runs in every browser tab before the app starts. Crashes the error pages
 * don't see (event handlers, timers, rejected promises) are reported too.
 */
window.addEventListener('error', (event) => {
  // "Script error." = a cross-origin script (browser extension, ad blocker): nothing we can fix.
  if (!event.error && event.message === 'Script error.') return;
  void reportClientError(event.error ?? event.message, 'window.error');
});

window.addEventListener('unhandledrejection', (event) => {
  void reportClientError(event.reason, 'unhandledrejection');
});
