import { callAction, guestActor, withRequest } from '@app/core';
import { unsubscribeNewsletter } from '@app/core/newsletter';

import { requestInfoFrom } from '@/lib/request-info';

import { esc, page, publicOrigin } from '../../_lib/page';

/**
 * The unsubscribe link in newsletters (`/api/v1/newsletter/unsubscribe?t=<token>`, see
 * `newsletterUnsubscribeUrl`). GET shows a button; POST unsubscribes: a person's click
 * is redirected (303) to /newsletter/unsubscribed; the one-click List-Unsubscribe POST gets JSON.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('t') ?? '';
  return page(
    'Unsubscribe from the newsletter?',
    `<form method="post" action="/api/v1/newsletter/unsubscribe?t=${encodeURIComponent(token)}"><button type="submit">Unsubscribe</button></form>`,
  );
}

export async function POST(req: Request) {
  // Mail apps' one-click unsubscribe (RFC 8058) posts `List-Unsubscribe=One-Click`: they want a
  // plain answer, not a redirect to a web page.
  const oneClick = (await req.clone().text()).includes('List-Unsubscribe=One-Click');
  const token = new URL(req.url).searchParams.get('t') ?? '';
  const actor = withRequest(
    guestActor('web'),
    requestInfoFrom(req.headers, '/api/v1/newsletter/unsubscribe'),
  );
  const result = await callAction(unsubscribeNewsletter, { token }, actor);
  if (!result.ok) return page('That link isn’t valid', `<p>${esc(result.error.message)}</p>`, 400);
  if (oneClick) return Response.json({ ok: true });
  return Response.redirect(new URL('/newsletter/unsubscribed', publicOrigin(req)), 303);
}
