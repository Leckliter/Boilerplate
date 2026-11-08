import { type NextRequest, NextResponse } from 'next/server';

import { DEV_COOKIE, devLoginEnabled } from '@/lib/auth/dev';
import { safeNext } from '@/lib/safe-next';

/**
 * GET /api/dev-login?email=owner@example.com&next=/admin — signs you in as that email in ONE request.
 * Development only: 404 unless NODE_ENV !== 'production' and DEV_LOGIN=1 (lib/auth/dev.ts).
 */
export function GET(request: NextRequest) {
  if (!devLoginEnabled()) return new NextResponse('Not found', { status: 404 });
  const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase();
  if (!email) return new NextResponse('?email= is required', { status: 400 });
  const response = NextResponse.redirect(
    new URL(safeNext(request.nextUrl.searchParams.get('next'), '/account'), request.nextUrl.origin),
  );
  response.cookies.set(DEV_COOKIE, encodeURIComponent(email), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  return response;
}
