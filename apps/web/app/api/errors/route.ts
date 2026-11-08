import { reportError } from '@app/core';
import { z } from 'zod';

import { requestInfoFrom } from '@/lib/request-info';
import { underLimit } from '@/lib/throttle';
import { getActor } from '@/lib/viewer';

const Body = z.object({
  name: z.string().max(200).optional(),
  message: z.string().max(2_000),
  stack: z.string().max(20_000).optional(),
  /** The page the browser was on. */
  url: z.string().max(2_000).optional(),
  /** React's component stack, when an error boundary caught it. */
  componentStack: z.string().max(10_000).optional(),
  /** Where it was caught: an error page (`boundary`), or a global handler. */
  via: z.enum(['boundary', 'global-error', 'window.error', 'unhandledrejection', 'fetch']),
});

/**
 * POST /api/errors — the browser reports a crash in client code (see
 * instrumentation-client.ts and the error pages). Responds { ref } — the
 * reference the error page shows. Server crashes are reported on the server
 * (instrumentation.ts), so they never come through here.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ error: 'Same-origin only' }, { status: 403 });
  const text = await req.text();
  if (text.length > 40_000) return Response.json({ error: 'Too large' }, { status: 413 });

  const request = requestInfoFrom(req.headers);
  // A crash loop in one browser must not flood the table.
  if (!underLimit(`errors:${request.ip}`, 10)) {
    return Response.json({ error: 'Too many' }, { status: 429 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(JSON.parse(text));
  } catch {
    // Expected: a malformed report from the browser is the sender's problem, not ours.
    return Response.json({ error: 'Invalid report' }, { status: 400 });
  }

  const err = Object.assign(new Error(body.message), { name: body.name ?? 'Error' });
  err.stack = body.stack ?? `${err.name}: ${err.message}`;
  const ref = await reportError(err, {
    source: 'client',
    actor: await getActor(),
    request: { ...request, path: body.url ? safePath(body.url) : null },
    context: { url: body.url, via: body.via, componentStack: body.componentStack },
  });
  return Response.json({ ref });
}

function isSameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    // Expected: an unparseable Origin header simply isn't ours.
    return false;
  }
}

function safePath(url: string) {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    // Expected: not a URL — keep nothing rather than garbage.
    return null;
  }
}
