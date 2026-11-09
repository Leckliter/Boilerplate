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

type ProviderError = { message?: string; status?: number; code?: string | number };

/**
 * A 4xx answer is the person's mistake (wrong code, bad address, too many tries): say so. Anything else
 * (Neon Auth down, a 5xx, a network failure) is a bug or an outage: throw a plain Error so the sign-in
 * action reports it and shows an E- reference, instead of telling someone their correct code is wrong.
 */
function isUserError(error: ProviderError): boolean {
  return typeof error.status === 'number' && error.status >= 400 && error.status < 500;
}

const SESSION_TOKEN_COOKIE = 'neon-auth.session_token';

type NeonUser = { id: string; email: string; emailVerified?: boolean; name?: string | null };

const toSession = (u: NeonUser): AuthSession => ({
  userId: u.id,
  email: u.email.toLowerCase(),
  emailVerified: Boolean(u.emailVerified),
  name: u.name ?? null,
});

const LOGIN_PATH = '/login';

export function neonAdapter(): AuthAdapter {
  const auth = neonAuth();
  return {
    async getSession() {
      const { data } = await auth.getSession();
      return data?.user ? toSession(data.user as NeonUser) : null;
    },
    async sendEmailCode(email) {
      const { error } = await auth.emailOtp.sendVerificationOtp({ email, type: 'sign-in' });
      if (error) {
        if (!isUserError(error)) {
          throw new Error(
            `Neon Auth could not send the sign-in code (${error.status}): ${error.message}`,
          );
        }
        throw new AuthFailure(
          error.message ?? 'Could not send the code.',
          String(error.code ?? 'otp_send_failed'),
        );
      }
    },
    async verifyEmailCode(email, code) {
      const { data, error } = await auth.signIn.emailOtp({ email, otp: code.trim() });
      if (error && !isUserError(error)) {
        throw new Error(
          `Neon Auth could not check the sign-in code (${error.status}): ${error.message}`,
        );
      }
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
    // visitors to `loginUrl`; we only want to know that, so that redirect is read, not followed
    // (its Set-Cookie headers, which clear a stale cookie, are kept). It lets `/login` itself through
    // without looking at the session, so there the answer comes from the session cookie.
    async refreshSession(request: NextRequest) {
      const result = await auth.middleware({ loginUrl: LOGIN_PATH })(request);
      const location = result.headers.get('location');
      const toLogin =
        result.status >= 300 &&
        result.status < 400 &&
        location !== null &&
        new URL(location, request.url).pathname === LOGIN_PATH;
      if (toLogin) {
        const response = NextResponse.next();
        for (const cookie of result.headers.getSetCookie()) {
          response.headers.append('set-cookie', cookie);
        }
        return { signedIn: false, response };
      }
      const { pathname } = request.nextUrl;
      if (pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`)) {
        const hasToken = request.cookies
          .getAll()
          .some((c) => c.name.endsWith(SESSION_TOKEN_COOKIE));
        return { signedIn: hasToken, response: result };
      }
      return { signedIn: true, response: result };
    },
  };
}
