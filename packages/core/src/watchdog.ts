/**
 * Says in the server log when something is STILL running after `ms` (default 10 s), and
 * again when it finally finishes. A request that hangs until Vercel's 300 s timeout
 * otherwise leaves nothing but "Task timed out" — this names what it was waiting on.
 */
export async function watched<T>(label: string, work: () => Promise<T>, ms = 10_000): Promise<T> {
  const started = Date.now();
  let slow = false;
  const timer = setTimeout(() => {
    slow = true;
    console.warn(`[slow] ${label}: still running after ${ms / 1000} s`);
  }, ms);
  // Don't keep a finished serverless function (or a test run) alive just for this timer.
  timer.unref?.();
  try {
    return await work();
  } finally {
    clearTimeout(timer);
    if (slow) console.warn(`[slow] ${label}: finished after ${Date.now() - started} ms`);
  }
}
