'use server';

import { reportError, resolveSignedInContact } from '@app/core';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import {
  recordCodeRequested,
  recordFailedSignIn,
  recordSignIn,
  recordSignOut,
} from '../auth-events';
import { currentRequestInfo } from '../request-info';
import { safeNext } from '../safe-next';
import { underLimit } from '../throttle';
import { getAuthAdapter } from './index';
import { AuthFailure } from './types';

/**
 * The sign-in server actions. They are the only place the login page talks to the auth provider, and they
 * only use the AuthAdapter interface, so Neon and Supabase are interchangeable (docs/choosing-a-backend.md).
 * (Not business actions: signing in creates no business data. Linking the login to a contact is core's
 * `resolveSignedInContact`, called by `getViewer`.)
 */
export type SignInState =
  | { step: 'email'; error?: string }
  | { step: 'code'; email: string; error?: string; notice?: string };

const Email = z.email().max(320);

export async function requestCode(_prev: SignInState, form: FormData): Promise<SignInState> {
  const parsed = Email.safeParse(String(form.get('email') ?? '').trim().toLowerCase());
  if (!parsed.success) return { step: 'email', error: 'Enter a valid email address.' };
  const email = parsed.data;
  const request = await currentRequestInfo();
  if (!underLimit(`code:${request.ip}`, 10, 10 * 60_000)) {
    return { step: 'email', error: 'Too many attempts. Wait a few minutes and try again.' };
  }
  const adapter = await getAuthAdapter();
  if (!adapter) return { step: 'email', error: 'Sign-in is not set up on this site yet.' };
  try {
    await adapter.sendEmailCode(email);
  } catch (err) {
    if (err instanceof AuthFailure) return { step: 'email', error: err.message };
    const ref = await reportError(err, { source: 'action', action: 'auth.sendEmailCode', request });
    return { step: 'email', error: `We couldn’t send the code. Error reference: ${ref}` };
  }
  await recordCodeRequested(email);
  return { step: 'code', email, notice: 'Code sent.' };
}

export async function verifyCode(
  prev: SignInState,
  form: FormData,
): Promise<SignInState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const code = String(form.get('code') ?? '').replace(/\s+/g, '');
  const next = safeNext(String(form.get('next') ?? ''), '/account');
  if (!email) return { step: 'email' };
  if (!/^\d{4,10}$/.test(code)) return { step: 'code', email, error: 'Enter the digits from the email.' };
  const adapter = await getAuthAdapter();
  if (!adapter) return { step: 'email', error: 'Sign-in is not set up on this site yet.' };
  try {
    const session = await adapter.verifyEmailCode(email, code);
    await recordSignIn(session, 'email_code');
    // Link the login to its contact now, so the first page already knows who this is.
    await resolveSignedInContact({
      id: session.userId,
      email: session.email,
      emailVerified: session.emailVerified,
      name: session.name ?? null,
    });
  } catch (err) {
    if (err instanceof AuthFailure) {
      await recordFailedSignIn(email, err.code);
      return { step: 'code', email, error: err.message };
    }
    const ref = await reportError(err, { source: 'action', action: 'auth.verifyEmailCode', request: await currentRequestInfo() });
    return { step: 'code', email, error: `We couldn’t sign you in. Error reference: ${ref}` };
  }
  void prev;
  redirect(next);
}

export async function signOut() {
  const adapter = await getAuthAdapter();
  try {
    const session = await adapter?.getSession();
    if (session) await recordSignOut(session);
    await adapter?.signOut();
  } catch (err) {
    // Signing out must still work: report it and clear what we can.
    await reportError(err, { source: 'action', action: 'auth.signOut', request: await currentRequestInfo() });
  }
  redirect('/');
}
