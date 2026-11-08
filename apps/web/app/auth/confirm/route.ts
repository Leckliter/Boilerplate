import { reportError } from '@app/core';
import { type NextRequest, NextResponse } from 'next/server';

import { getAuthAdapter, AuthFailure } from '@/lib/auth';
import { recordSignIn } from '@/lib/auth-events';
import { safeNext } from '@/lib/safe-next';

/**
 * GET /auth/confirm?token_hash=…&type=email&next=/account — the landing page of an emailed sign-in link
 * (Supabase magic link). Providers without links (Neon uses codes) never reach it. A bad link goes
 * back to /login with an error; anything unexpected is reported.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') ?? 'email';
  const next = safeNext(searchParams.get('next'));
  const fail = NextResponse.redirect(new URL('/login?error=link', origin));
  if (!tokenHash) return fail;
  try {
    const adapter = await getAuthAdapter();
    if (!adapter?.confirmLink) return fail;
    const session = await adapter.confirmLink({ tokenHash, type });
    await recordSignIn(session, 'email_link');
    return NextResponse.redirect(new URL(next, origin));
  } catch (err) {
    if (err instanceof AuthFailure) return fail;
    await reportError(err, { source: 'request', context: { where: '/auth/confirm' } });
    return fail;
  }
}
