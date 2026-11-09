import { callAction, guestActor, withRequest } from '@app/core';
import { unsubscribeNewsletter } from '@app/core/newsletter';

import { requestInfoFrom } from '@/lib/request-info';

import { esc, page } from '../../_lib/page';

/**
 * The unsubscribe link in newsletters (`/api/v1/newsletter/unsubscribe?t=<token>`, see
 * `newsletterUnsubscribeUrl`). GET shows a button; POST (also what mail apps’ one-click
 * List-Unsubscribe sends) unsubscribes.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('t') ?? '';
  return page(
    'Unsubscribe from the newsletter?',
    `<form method="post" action="/api/v1/newsletter/unsubscribe?t=${encodeURIComponent(token)}"><button type="submit">Unsubscribe</button></form>`,
  );
}

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get('t') ?? '';
  const actor = withRequest(
    guestActor('web'),
    requestInfoFrom(req.headers, '/api/v1/newsletter/unsubscribe'),
  );
  const result = await callAction(unsubscribeNewsletter, { token }, actor);
  if (!result.ok) return page('That link isn’t valid', `<p>${esc(result.error.message)}</p>`, 400);
  return page('You’re unsubscribed', '<p>You will no longer get our newsletter.</p>');
}
