import 'server-only';

import {
  type Actor,
  guestActor,
  type Permission,
  reportError,
  resolveSignedInContact,
  userActor,
  watched,
  withRequest,
} from '@app/core';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { cache } from 'react';

import { getAuthAdapter } from './auth';
import { currentRequestInfo } from './request-info';

export type Viewer =
  | { status: 'guest' }
  | { status: 'verify_email'; email: string }
  | { status: 'disabled' }
  | {
      status: 'signed_in';
      contactId: string;
      displayName: string;
      email: string;
      roles: string[];
      actor: Actor;
      can: (p: Permission) => boolean;
    };

/** Who is looking at this page? Cached per request. Provider-neutral: depends only on AuthAdapter. */
export const getViewer = cache(async (): Promise<Viewer> => {
  // Who is signed in differs per request, so never prerender a page that asks.
  await connection();
  const adapter = await getAuthAdapter();
  if (!adapter) return { status: 'guest' };
  let session;
  try {
    session = await watched('getViewer: auth getSession', () => adapter.getSession());
  } catch (err) {
    // The provider is down or misconfigured: report it (with a reference in the log) and show the site signed out.
    await reportError(err, {
      source: 'request',
      context: { where: 'getViewer', backend: process.env.BACKEND },
    });
    return { status: 'guest' };
  }
  if (!session?.email) return { status: 'guest' };

  const contact = await watched('getViewer: resolveSignedInContact', () =>
    resolveSignedInContact({
      id: session.userId,
      email: session.email,
      emailVerified: session.emailVerified,
      name: session.name ?? null,
    }),
  );
  if (contact.status === 'disabled') return { status: 'disabled' };
  if (contact.status !== 'ok') return { status: 'verify_email', email: session.email };

  const actor = withRequest(
    userActor({ contactId: contact.contactId, roles: contact.roles }),
    await currentRequestInfo(),
  );
  return {
    status: 'signed_in',
    contactId: contact.contactId,
    displayName: contact.displayName,
    email: session.email,
    roles: contact.roles,
    actor,
    can: (p) => actor.permissions.has(p),
  };
});

export type SignedInViewer = Extract<Viewer, { status: 'signed_in' }>;

/** The actor for running actions on behalf of whoever made this request. */
export async function getActor(): Promise<Actor> {
  const viewer = await getViewer();
  return viewer.status === 'signed_in'
    ? viewer.actor
    : withRequest(guestActor('web'), await currentRequestInfo());
}

/** Use at the top of a protected layout/page. Redirects instead of rendering when not allowed. */
export async function requireViewer(permission?: Permission, next = '/'): Promise<SignedInViewer> {
  const viewer = await getViewer();
  if (viewer.status === 'guest') redirect(`/login?next=${encodeURIComponent(next)}`);
  if (viewer.status === 'verify_email') redirect('/verify-email');
  if (viewer.status === 'disabled') redirect('/verify-email?disabled=1');
  if (permission && !viewer.can(permission)) redirect('/account?denied=1');
  return viewer;
}
