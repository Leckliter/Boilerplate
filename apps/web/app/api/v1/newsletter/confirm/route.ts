import { callAction, guestActor, withRequest } from '@app/core';
import { confirmNewsletter } from '@app/core/newsletter';

import { requestInfoFrom } from '@/lib/request-info';

import { esc, page, publicOrigin } from '../../_lib/page';

/**
 * The confirmation link in the newsletter double opt-in email (`/api/v1/newsletter/confirm?t=<token>`).
 * GET shows a button (a mail scanner opening the link must not subscribe anyone); POST confirms.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('t') ?? '';
  return page(
    'Confirm your subscription',
    `<p>One click and you’re on the list.</p><form method="post" action="/api/v1/newsletter/confirm?t=${encodeURIComponent(token)}"><button type="submit">Yes, subscribe me</button></form>`,
  );
}

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get('t') ?? '';
  const actor = withRequest(
    guestActor('web'),
    requestInfoFrom(req.headers, '/api/v1/newsletter/confirm'),
  );
  const result = await callAction(confirmNewsletter, { token }, actor);
  if (!result.ok) return page('That link isn’t valid', `<p>${esc(result.error.message)}</p>`, 400);
  // A person clicking the button lands on the site's own page.
  return Response.redirect(new URL('/newsletter/confirmed', publicOrigin(req)), 303);
}
