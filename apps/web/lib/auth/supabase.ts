import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { type AuthAdapter, AuthFailure, type AuthSession } from './types';

/**
 * BACKEND=supabase: Supabase Auth, email OTP code or magic link.
 * Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY. Session only: never `supabase.from()`.
 * Remove Supabase: delete this file, the `@supabase/ssr` dependency and the env block.
 * Email template tip: put `{{ .Token }}` in "Magic Link" so the same email carries the code, and
 * point the link at `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.
 */
function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set.');
  return { url, key };
}

async function client() {
  const { url, key } = env();
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Expected: Server Components cannot set cookies; proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

/**
 * A 4xx answer is the person's mistake (wrong or expired code, rate limit): say so. Anything else
 * (Supabase down, a 5xx, a network failure) throws a plain Error so the sign-in action reports it and
 * shows an E- reference instead of calling a correct code wrong.
 */
function isUserError(error: { status?: number }): boolean {
  return typeof error.status === 'number' && error.status >= 400 && error.status < 500;
}

type SupabaseUser = {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
  user_metadata?: { full_name?: string; name?: string };
};

const toSession = (u: SupabaseUser): AuthSession => ({
  userId: u.id,
  email: (u.email ?? '').toLowerCase(),
  emailVerified: Boolean(u.email_confirmed_at),
  name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
});

export function supabaseAdapter(): AuthAdapter {
  return {
    async getSession() {
      // getUser() asks Supabase Auth (not just the cookie), so it cannot be spoofed.
      const { data } = await (await client()).auth.getUser();
      return data.user?.email ? toSession(data.user) : null;
    },
    async sendEmailCode(email) {
      const { error } = await (
        await client()
      ).auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) {
        if (!isUserError(error))
          throw new Error(`Supabase Auth could not send the code: ${error.message}`);
        throw new AuthFailure(error.message, error.code ?? 'otp_failed');
      }
    },
    async verifyEmailCode(email, code) {
      const { data, error } = await (
        await client()
      ).auth.verifyOtp({
        email,
        token: code.trim(),
        type: 'email',
      });
      if (error && !isUserError(error)) {
        throw new Error(`Supabase Auth could not check the code: ${error.message}`);
      }
      if (error || !data.user) {
        throw new AuthFailure(
          'That code is wrong or has expired. Ask for a new one.',
          error?.code ?? 'otp_invalid',
        );
      }
      return toSession(data.user);
    },
    async signOut() {
      // `local`: this browser only. Supabase's default (`global`) would also sign the person out of
      // their phone and every other device.
      await (await client()).auth.signOut({ scope: 'local' });
    },
    async confirmLink({ tokenHash, type }) {
      const { data, error } = await (
        await client()
      ).auth.verifyOtp({
        token_hash: tokenHash,
        type: type as 'email' | 'magiclink' | 'signup' | 'recovery' | 'invite' | 'email_change',
      });
      if (error && !isUserError(error)) {
        throw new Error(`Supabase Auth could not check the link: ${error.message}`);
      }
      if (error || !data.user) {
        throw new AuthFailure(
          'That link is invalid or has expired.',
          error?.code ?? 'link_invalid',
        );
      }
      return toSession(data.user);
    },
    async refreshSession(request: NextRequest) {
      const { url, key } = env();
      // No sign-in cookie: nothing to refresh, so skip Supabase (most public visitors).
      if (!request.cookies.getAll().some((c) => c.name.startsWith('sb-'))) {
        return { signedIn: false, response: NextResponse.next() };
      }
      let response = NextResponse.next({ request });
      const supabase = createServerClient(url, key, {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll(list, headers) {
            for (const { name, value } of list) request.cookies.set(name, value);
            response = NextResponse.next({ request });
            for (const { name, value, options } of list) response.cookies.set(name, value, options);
            for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
          },
        },
      });
      // Must run right after creating the client: refreshes the token if needed.
      const { data } = await supabase.auth.getClaims();
      return { signedIn: Boolean(data?.claims), response };
    },
  };
}
