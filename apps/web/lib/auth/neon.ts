import 'server-only';

import { createNeonAuth } from '@neondatabase/auth/next/server';
import { type NextRequest, NextResponse } from 'next/server';

import { type AuthAdapter, AuthFailure, type AuthSession } from './types';

/**
 * BACKEND=neon: Neon Auth (managed Better Auth), email one-time code.
 * Env: NEON_AUTH_BASE_URL, NEON_AUTH_COOKIE_SECRET (>= 32 chars). Session only; data never goes
 * through Neon Auth or the Data API (docs/choosing-a-backend.md). The `/api/auth/*` route
 * (app/api/auth/[...path]/route.ts) proxies the provider's endpoints for the session cookie.
 * Remove Neon: delete this file, `app/api/auth/`, the `@neondatabase/auth` dependency and the env block.
 */
let instance: ReturnType<typeof createNeonAuth> | undefined;

export function neonAuth() {
  instance ??= createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL ?? '',
    cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET ?? '' },
  });
  return instance;
}

type NeonUser = { id: string; email: string; emailVerified?: boolean; name?: string | null };

const toSession = (u: NeonUser): AuthSession => ({
  userId: u.id,
  email: u.email.toLowerCase(),
  emailVerified: Boolean(u.emailVerified),
  name: u.name ?? null,
});

export function neonAdapter(): AuthAdapter {
  const auth = neonAuth();
  return {
    async getSession() {
      const { data } = await auth.getSession();
      return data?.user ? toSession(data.user as NeonUser) : null;
    },
    async sendEmailCode(email) {
      const { error } = await auth.emailOtp.sendVerificationOtp({ email, type: 'sign-in' });
      if (error)
        throw new AuthFailure(
          error.message ?? 'Could not send the code.',
          String(error.code ?? ''),
        );
    },
    async verifyEmailCode(email, code) {
      const { data, error } = await auth.signIn.emailOtp({ email, otp: code.trim() });
      if (error || !data?.user) {
        throw new AuthFailure(
          'That code is wrong or has expired. Ask for a new one.',
          String(error?.code ?? 'invalid_otp'),
        );
      }
      return toSession(data.user as NeonUser);
    },
    async signOut() {
      await auth.signOut();
    },
    // Neon Auth refreshes its session cookie inside its middleware. It redirects signed-out
    // visitors to `loginUrl`; we only want to know that, so that redirect is read, not followed.
    async refreshSession(request: NextRequest) {
      const result = await auth.middleware({ loginUrl: '/login' })(request);
      const location = result.headers.get('location');
      const toLogin = result.status >= 300 && result.status < 400 && location?.includes('/login');
      return { signedIn: !toLogin, response: toLogin ? NextResponse.next() : result };
    },
  };
}
