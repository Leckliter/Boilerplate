import { callAction, guestActor, withRequest } from '@app/core';
import { unsubscribe } from '@app/core/notifications';

import { requestInfoFrom } from '@/lib/request-info';

/**
 * The unsubscribe link in optional notification emails (`/api/v1/unsubscribe?t=<signed token>`).
 * Works without signing in: the token names one person and one notification type and cannot be
 * forged without NOTIFICATIONS_SECRET.
 *
 * - POST: what mail apps' one-click unsubscribe sends (RFC 8058); also the button below.
 * - GET: a tiny confirmation page (a link scanner opening the URL must not unsubscribe anyone).
 */
async function run(req: Request, token: string) {
  const actor = withRequest(guestActor('web'), requestInfoFrom(req.headers, '/api/v1/unsubscribe'));
  return callAction(unsubscribe, { token }, actor);
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const page = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5}button{font:inherit;padding:.6rem 1rem}</style></head>
<body><h1>${esc(title)}</h1>${body}</body></html>`,
    {
      status,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    },
  );

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('t') ?? '';
  return page(
    'Unsubscribe from these emails?',
    `<form method="post" action="/api/v1/unsubscribe?t=${encodeURIComponent(token)}"><button type="submit">Unsubscribe</button></form>
<p>You can change this any time under Account → Notifications.</p>`,
  );
}

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get('t') ?? '';
  const result = await run(req, token);
  // Mail apps' one-click POST only looks at the status; people see the page.
  if (!result.ok) return page('That link isn’t valid', `<p>${esc(result.error.message)}</p>`, 400);
  return page(
    'You’re unsubscribed',
    `<p>You will no longer get “${esc(result.data.label)}” emails.</p>`,
  );
}
