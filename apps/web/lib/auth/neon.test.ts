import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthFailure } from './types';

const sdk = vi.hoisted(() => ({
  getSession: vi.fn(),
  sendVerificationOtp: vi.fn(),
  signInEmailOtp: vi.fn(),
  signOut: vi.fn(),
  middleware: vi.fn(),
  config: undefined as unknown,
}));

vi.mock('@neondatabase/auth/next/server', () => ({
  createNeonAuth: (config: unknown) => {
    sdk.config = config;
    return {
      getSession: sdk.getSession,
      emailOtp: { sendVerificationOtp: sdk.sendVerificationOtp },
      signIn: { emailOtp: sdk.signInEmailOtp },
      signOut: sdk.signOut,
      middleware: () => sdk.middleware,
    };
  },
}));

const { neonAdapter } = await import('./neon');

const neonUser = { id: 'u_1', email: 'Ada@Example.com', emailVerified: true, name: 'Ada' };

beforeEach(() => {
  vi.resetAllMocks();
  process.env.NEON_AUTH_BASE_URL = 'https://auth.example.neon.tech';
  process.env.NEON_AUTH_COOKIE_SECRET = 'x'.repeat(32);
});

describe('neon adapter: getSession', () => {
  it('maps the Neon user and lower-cases the email', async () => {
    sdk.getSession.mockResolvedValue({ data: { user: neonUser, session: {} } });
    expect(await neonAdapter().getSession()).toEqual({
      userId: 'u_1',
      email: 'ada@example.com',
      emailVerified: true,
      name: 'Ada',
    });
  });

  it('is null when nobody is signed in', async () => {
    sdk.getSession.mockResolvedValue({ data: null });
    expect(await neonAdapter().getSession()).toBeNull();
  });

  it('configures the SDK with the base URL and cookie secret from the environment', async () => {
    sdk.getSession.mockResolvedValue({ data: null });
    await neonAdapter().getSession();
    expect(sdk.config).toMatchObject({
      baseUrl: 'https://auth.example.neon.tech',
      cookies: { secret: 'x'.repeat(32) },
    });
  });
});

describe('neon adapter: sendEmailCode', () => {
  it('asks Neon for a sign-in code', async () => {
    sdk.sendVerificationOtp.mockResolvedValue({ data: { success: true }, error: null });
    await neonAdapter().sendEmailCode('ada@example.com');
    expect(sdk.sendVerificationOtp).toHaveBeenCalledWith({
      email: 'ada@example.com',
      type: 'sign-in',
    });
  });

  it('tells the person about a 4xx (too many tries)', async () => {
    sdk.sendVerificationOtp.mockResolvedValue({
      data: null,
      error: { status: 429, message: 'Too many requests', code: 'RATE_LIMITED' },
    });
    await expect(neonAdapter().sendEmailCode('a@b.co')).rejects.toMatchObject({
      name: 'AuthFailure',
      message: 'Too many requests',
      code: 'RATE_LIMITED',
    });
  });

  it('throws a plain Error (to be reported with an E- reference) when Neon is down', async () => {
    sdk.sendVerificationOtp.mockResolvedValue({
      data: null,
      error: { status: 502, message: 'Bad Gateway' },
    });
    const err = await neonAdapter()
      .sendEmailCode('a@b.co')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(AuthFailure);
  });
});

describe('neon adapter: verifyEmailCode', () => {
  it('signs in with the trimmed code and returns the session', async () => {
    sdk.signInEmailOtp.mockResolvedValue({ data: { user: neonUser }, error: null });
    const session = await neonAdapter().verifyEmailCode('ada@example.com', ' 123456 ');
    expect(sdk.signInEmailOtp).toHaveBeenCalledWith({ email: 'ada@example.com', otp: '123456' });
    expect(session.userId).toBe('u_1');
    expect(session.emailVerified).toBe(true);
  });

  it('says a wrong code is wrong (4xx)', async () => {
    sdk.signInEmailOtp.mockResolvedValue({
      data: null,
      error: { status: 400, code: 'INVALID_OTP', message: 'Invalid OTP' },
    });
    const err = await neonAdapter()
      .verifyEmailCode('a@b.co', '000000')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthFailure);
    expect((err as AuthFailure).code).toBe('INVALID_OTP');
    expect((err as AuthFailure).message).toMatch(/wrong or has expired/);
  });

  it('does not call a correct code wrong when Neon is down (5xx)', async () => {
    sdk.signInEmailOtp.mockResolvedValue({ data: null, error: { status: 503, message: 'down' } });
    const err = await neonAdapter()
      .verifyEmailCode('a@b.co', '123456')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(AuthFailure);
  });

  it('refuses an answer with no user', async () => {
    sdk.signInEmailOtp.mockResolvedValue({ data: { user: null }, error: null });
    await expect(neonAdapter().verifyEmailCode('a@b.co', '123456')).rejects.toBeInstanceOf(
      AuthFailure,
    );
  });
});

describe('neon adapter: signOut', () => {
  it('signs out through the SDK, which clears the cookies', async () => {
    sdk.signOut.mockResolvedValue({ data: { success: true } });
    await neonAdapter().signOut();
    expect(sdk.signOut).toHaveBeenCalledOnce();
  });
});

describe('neon adapter: refreshSession (proxy.ts)', () => {
  const req = (path: string, cookie?: string) =>
    new NextRequest(`https://app.test${path}`, cookie ? { headers: { cookie } } : undefined);

  it('reports signed in when the SDK lets the request through, keeping its cookies', async () => {
    const through = NextResponse.next();
    through.headers.append('set-cookie', '__Secure-neon-auth.session_data=abc; Path=/');
    sdk.middleware.mockResolvedValue(through);
    const result = await neonAdapter().refreshSession!(req('/account'));
    expect(result.signedIn).toBe(true);
    expect(result.response).toBe(through);
  });

  it('reads the redirect to /login as signed out and does not follow it', async () => {
    sdk.middleware.mockResolvedValue(NextResponse.redirect('https://app.test/login?next=/admin'));
    const result = await neonAdapter().refreshSession!(req('/admin'));
    expect(result.signedIn).toBe(false);
    expect(result.response.headers.get('location')).toBeNull();
  });

  it('keeps the cookie-clearing headers of that redirect', async () => {
    const redirect = NextResponse.redirect('https://app.test/login');
    redirect.headers.append('set-cookie', '__Secure-neon-auth.session_data=; Max-Age=0; Path=/');
    sdk.middleware.mockResolvedValue(redirect);
    const result = await neonAdapter().refreshSession!(req('/'));
    expect(result.response.headers.getSetCookie()).toEqual([
      '__Secure-neon-auth.session_data=; Max-Age=0; Path=/',
    ]);
  });

  it('is not fooled by another redirect that merely contains "/login" in its URL', async () => {
    sdk.middleware.mockResolvedValue(NextResponse.redirect('https://app.test/blog/login-tips'));
    const result = await neonAdapter().refreshSession!(req('/account'));
    expect(result.signedIn).toBe(true);
  });

  it('on /login (which the SDK never checks) answers from the session cookie', async () => {
    sdk.middleware.mockResolvedValue(NextResponse.next());
    const out = await neonAdapter().refreshSession!(req('/login'));
    expect(out.signedIn).toBe(false);
    const inn = await neonAdapter().refreshSession!(
      req('/login', '__Secure-neon-auth.session_token=tok'),
    );
    expect(inn.signedIn).toBe(true);
  });
});
