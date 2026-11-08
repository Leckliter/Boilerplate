import type { Instrumentation } from 'next';

/**
 * Next.js calls this for every server crash it catches: a page or layout that threw while rendering, a
 * route handler, a server action, or proxy.ts. Each one becomes an error report (app.error_events). The
 * error page shows the person `digest`, which errors.get accepts as a reference.
 *
 * Actions never get here: runAction catches and reports their errors itself.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // Redirects, notFound() and "this page must render dynamically" are thrown by design; not crashes.
  const digest =
    typeof err === 'object' && err !== null && 'digest' in err ? String(err.digest) : undefined;
  if (digest && /^(NEXT_|DYNAMIC_SERVER_USAGE|BAILOUT_TO_CLIENT_SIDE_RENDERING)/.test(digest)) {
    return;
  }

  // rules-ok: emit-notify-in-actions — a dynamic import of reportError only; no emit/notify here
  const core = await import('@app/core');
  const header = (name: string) => {
    const v = request.headers[name];
    return Array.isArray(v) ? v[0] : v;
  };
  await core.reportError(err, {
    source: 'request',
    digest,
    method: request.method,
    request: {
      id: header('x-vercel-id') ?? header('x-request-id') ?? crypto.randomUUID(),
      path: request.path,
      ip: header('x-forwarded-for')?.split(',')[0]?.trim() ?? header('x-real-ip'),
      userAgent: header('user-agent'),
    },
    context: {
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
    },
  });
};
