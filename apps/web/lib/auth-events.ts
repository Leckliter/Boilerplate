import 'server-only';

import { recordAuthEvent, resolveSignedInContact, runAction, systemActor } from '@app/core';
import { z } from 'zod';

import type { AuthSession } from './auth';
import { currentRequestInfo } from './request-info';
import { underLimit } from './throttle';

/**
 * Sign-in, sign-out and sign-in-code events for the activity log (docs/logging.md). Successes are
 * recorded from the server-verified session; failures are recorded as reported (limited per IP) and
 * never attributed to the person whose email was typed.
 */
const Email = z.email().max(320);

export async function recordSignIn(session: AuthSession, method: 'email_code' | 'email_link') {
  await recordAuthEvent({
    action: 'auth.signIn',
    ok: true,
    summary: `Signed in (${session.email})`,
    authUserId: session.userId,
    email: session.email,
    request: await currentRequestInfo(),
    detail: { method },
  });
  // Lets automations react to "user.signed_in" (events module; delete this block if you remove it).
  const contact = await resolveSignedInContact({
    id: session.userId,
    email: session.email,
    emailVerified: true,
  });
  if (contact.status !== 'ok') return;
  await runAction(
    'events.recordSignIn',
    { contactId: contact.contactId, displayName: contact.displayName, first: false },
    systemActor(),
  );
}

export async function recordFailedSignIn(email: string, reason: string) {
  const request = await currentRequestInfo();
  const parsed = Email.safeParse(email);
  if (!parsed.success || !underLimit(`signin-failed:${request.ip}`, 20, 10 * 60_000)) return;
  await recordAuthEvent({
    action: 'auth.signInFailed',
    ok: false,
    summary: `Failed sign-in for ${parsed.data} (${reason.slice(0, 60)})`,
    email: parsed.data,
    request,
    detail: { method: 'email_code', reason: reason.slice(0, 60) },
  });
}

export async function recordCodeRequested(email: string) {
  const request = await currentRequestInfo();
  await recordAuthEvent({
    action: 'auth.codeRequested',
    ok: true,
    summary: `Sign-in code emailed to ${email}`,
    email,
    request,
    detail: { method: 'email_code' },
  });
}

export async function recordSignOut(session: AuthSession) {
  await recordAuthEvent({
    action: 'auth.signOut',
    ok: true,
    summary: `Signed out (${session.email})`,
    authUserId: session.userId,
    email: session.email,
    request: await currentRequestInfo(),
  });
}
