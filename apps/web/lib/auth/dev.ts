import 'server-only';

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { type AuthAdapter, AuthFailure, type AuthSession } from './types';

/**
 * DEVELOPMENT ONLY sign-in, for working on the app (and taking screenshots) without a Neon or
 * Supabase project. On only when `NODE_ENV !== 'production'` AND `DEV_LOGIN=1`: in a production
 * build `devLoginEnabled()` is always false, so none of this is reachable.
 *
 * Any email works; the code is always `000000`. Whoever you sign in as is linked to the contact
 * with that (verified) email, so `pnpm db:seed` owners work: DEV_LOGIN=1, email owner@example.com.
 */
export const DEV_COOKIE = 'dev-login';
export const DEV_CODE = '000000';

export function devLoginEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.DEV_LOGIN === '1';
}

export function sessionFor(email: string): AuthSession {
  const clean = email.trim().toLowerCase();
  return { userId: `dev:${clean}`, email: clean, emailVerified: true, name: null };
}

function guard() {
  if (!devLoginEnabled()) throw new Error('Dev login is off (needs DEV_LOGIN=1, never in production).');
}

export const devAdapter: AuthAdapter = {
  async getSession() {
    guard();
    const email = (await cookies()).get(DEV_COOKIE)?.value;
    return email ? sessionFor(decodeURIComponent(email)) : null;
  },
  async sendEmailCode() {
    guard();
  },
  async verifyEmailCode(email, code) {
    guard();
    if (code.trim() !== DEV_CODE) throw new AuthFailure('That code is wrong (dev code is 000000).');
    (await cookies()).set(DEV_COOKIE, encodeURIComponent(email.trim().toLowerCase()), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
    return sessionFor(email);
  },
  async signOut() {
    guard();
    (await cookies()).delete(DEV_COOKIE);
  },
  async refreshSession(request: NextRequest) {
    guard();
    return { signedIn: request.cookies.has(DEV_COOKIE), response: NextResponse.next() };
  },
};
