import { type NextRequest, NextResponse } from 'next/server';

import { getAuthAdapter } from './lib/auth';

const PROTECTED = ['/account', '/admin'];
/** API routes that need the browser's sign-in session (everything else under /api uses API keys, the cron secret or is public). */
const LOGIN_API = ['/api/account'];

/**
 * Runs before every page request (Next 16 `proxy.ts`, the old middleware). Refreshes the sign-in
 * session cookie through the AuthAdapter, sends signed-out visitors away from /account and /admin
 * (a 401 for /api routes that need a login), and does nothing else. WHAT someone may see (roles) is
 * checked in each app's layout (lib/viewer.ts `requireViewer`) and in every action.
 */
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith('/api/') &&
    !LOGIN_API.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return NextResponse.next();
  }
  const guarded = isProtected(pathname) || pathname.startsWith('/api/');
  const adapter = await getAuthAdapter();
  if (!adapter?.refreshSession) return guarded ? denied(request) : NextResponse.next();

  const { signedIn, response } = await adapter.refreshSession(request);
  if (!signedIn && guarded) return denied(request);
  return response;
}

/** A signed-in app page (manifests stay public so the apps can be installed). */
function isProtected(pathname: string) {
  return (
    PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) &&
    !pathname.endsWith('.webmanifest')
  );
}

function denied(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith('/api/')) {
    return Response.json(
      { ok: false, error: { code: 'unauthenticated', message: 'Sign in first.' } },
      { status: 401 },
    );
  }
  const login = request.nextUrl.clone();
  login.pathname = '/login';
  login.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    // Everything except static files and images. API routes are let through above unless they need a login.
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|robots.txt|sitemap.xml).*)',
  ],
};
