import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthFailure } from './types';

type CookieOptions = {
  getAll: () => { name: string; value: string }[];
  setAll: (
    list: { name: string; value: string; options?: Record<string, unknown> }[],
    headers?: Record<string, string>,
  ) => void;
};

const sdk = vi.hoisted(() => ({
  getUser: vi.fn(),
  getClaims: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
  created: [] as { url: string; key: string; cookies: CookieOptions }[],
  store: new Map<string, string>(),
  setCookie: vi.fn(),
  failSet: false,
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: (url: string, key: string, options: { cookies: CookieOptions }) => {
    sdk.created.push({ url, key, cookies: options.cookies });
    return {
      auth: {
        getUser: sdk.getUser,
        getClaims: sdk.getClaims,
        signInWithOtp: sdk.signInWithOtp,
        verifyOtp: sdk.verifyOtp,
        signOut: sdk.signOut,
      },
    };
  },
}));

vi.mock('next/headers', () => ({
  // Next 16: cookies() is async.
  cookies: async () => ({
    getAll: () => [...sdk.store].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => {
      if (sdk.failSet)
        throw new Error('Cookies can only be modified in a Server Action or Route Handler');
      sdk.setCookie(name, value);
    },
  }),
}));

const { supabaseAdapter } = await import('./supabase');

const user = {
  id: '6b0f1c0e-0000-4000-8000-000000000001',
  email: 'Ada@Example.com',
  email_confirmed_at: '2026-11-01T00:00:00Z',
  user_metadata: { full_name: 'Ada Lovelace' },
};

beforeEach(() => {
  vi.resetAllMocks();
  sdk.created.length = 0;
  sdk.store.clear();
  sdk.failSet = false;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
});

describe('supabase adapter: getSession', () => {
  it('asks Supabase Auth (getUser), not just the cookie, and maps the user', async () => {
    sdk.getUser.mockResolvedValue({ data: { user }, error: null });
    expect(await supabaseAdapter().getSession()).toEqual({
      userId: user.id,
      email: 'ada@example.com',
      emailVerified: true,
      name: 'Ada Lovelace',
    });
    expect(sdk.created[0]).toMatchObject({ url: 'https://proj.supabase.co', key: 'anon-key' });
  });

  it('is null when there is no user (or no email)', async () => {
    sdk.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await supabaseAdapter().getSession()).toBeNull();
    sdk.getUser.mockResolvedValue({ data: { user: { id: 'x' } }, error: null });
    expect(await supabaseAdapter().getSession()).toBeNull();
  });

  it('reads the request cookies from Next 16 async cookies()', async () => {
    sdk.store.set('sb-proj-auth-token', 'tok');
    sdk.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await supabaseAdapter().getSession();
    expect(sdk.created[0]!.cookies.getAll()).toEqual([
      { name: 'sb-proj-auth-token', value: 'tok' },
    ]);
  });

  it('survives a Server Component that cannot set cookies (proxy.ts refreshes instead)', async () => {
    sdk.getUser.mockResolvedValue({ data: { user }, error: null });
    await supabaseAdapter().getSession();
    sdk.failSet = true;
    expect(() =>
      sdk.created[0]!.cookies.setAll([{ name: 'sb-x', value: 'v', options: {} }]),
    ).not.toThrow();
    sdk.failSet = false;
    sdk.created[0]!.cookies.setAll([{ name: 'sb-x', value: 'v', options: {} }]);
    expect(sdk.setCookie).toHaveBeenCalledWith('sb-x', 'v');
  });

  it('says what is missing when the environment is not set', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    await expect(supabaseAdapter().getSession()).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});

describe('supabase adapter: sendEmailCode', () => {
  it('sends a code and creates the login on first use', async () => {
    sdk.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    await supabaseAdapter().sendEmailCode('ada@example.com');
    expect(sdk.signInWithOtp).toHaveBeenCalledWith({
      email: 'ada@example.com',
      options: { shouldCreateUser: true },
    });
  });

  it('shows the person a 4xx (rate limit)', async () => {
    sdk.signInWithOtp.mockResolvedValue({
      data: {},
      error: {
        status: 429,
        code: 'over_email_send_rate_limit',
        message: 'Email rate limit exceeded',
      },
    });
    await expect(supabaseAdapter().sendEmailCode('a@b.co')).rejects.toMatchObject({
      name: 'AuthFailure',
      code: 'over_email_send_rate_limit',
      message: 'Email rate limit exceeded',
    });
  });

  it('throws a plain Error for an outage so it is reported with an E- reference', async () => {
    sdk.signInWithOtp.mockResolvedValue({ data: {}, error: { status: 500, message: 'boom' } });
    const err = await supabaseAdapter()
      .sendEmailCode('a@b.co')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(AuthFailure);
  });
});

describe('supabase adapter: verifyEmailCode', () => {
  it('verifies an email OTP with the trimmed code', async () => {
    sdk.verifyOtp.mockResolvedValue({ data: { user }, error: null });
    const session = await supabaseAdapter().verifyEmailCode('ada@example.com', ' 123456 ');
    expect(sdk.verifyOtp).toHaveBeenCalledWith({
      email: 'ada@example.com',
      token: '123456',
      type: 'email',
    });
    expect(session.userId).toBe(user.id);
  });

  it('a wrong or expired code is the person’s mistake', async () => {
    sdk.verifyOtp.mockResolvedValue({
      data: { user: null },
      error: { status: 403, code: 'otp_expired', message: 'Token has expired' },
    });
    const err = await supabaseAdapter()
      .verifyEmailCode('a@b.co', '111111')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthFailure);
    expect((err as AuthFailure).code).toBe('otp_expired');
  });

  it('an outage is not reported as a wrong code', async () => {
    sdk.verifyOtp.mockResolvedValue({
      data: { user: null },
      error: { status: 502, message: 'bad' },
    });
    const err = await supabaseAdapter()
      .verifyEmailCode('a@b.co', '111111')
      .catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(AuthFailure);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('supabase adapter: confirmLink (/auth/confirm)', () => {
  it('verifies a token hash', async () => {
    sdk.verifyOtp.mockResolvedValue({ data: { user }, error: null });
    const session = await supabaseAdapter().confirmLink!({ tokenHash: 'abc', type: 'email' });
    expect(sdk.verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'email' });
    expect(session.email).toBe('ada@example.com');
  });

  it('an invalid or used link is the person’s mistake', async () => {
    sdk.verifyOtp.mockResolvedValue({ data: { user: null }, error: { status: 403, message: 'x' } });
    await expect(
      supabaseAdapter().confirmLink!({ tokenHash: 'abc', type: 'email' }),
    ).rejects.toBeInstanceOf(AuthFailure);
  });
});

describe('supabase adapter: signOut', () => {
  it('signs out this browser only, not every device', async () => {
    sdk.signOut.mockResolvedValue({ error: null });
    await supabaseAdapter().signOut();
    expect(sdk.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});

describe('supabase adapter: refreshSession (proxy.ts)', () => {
  const req = (cookie?: string) =>
    new NextRequest('https://app.test/account', cookie ? { headers: { cookie } } : undefined);

  it('skips Supabase entirely for a visitor with no sb- cookie', async () => {
    const result = await supabaseAdapter().refreshSession!(req('theme=dark'));
    expect(result.signedIn).toBe(false);
    expect(sdk.created).toHaveLength(0);
  });

  it('refreshes through getClaims and writes new cookies and cache headers on the response', async () => {
    sdk.getClaims.mockImplementation(async () => {
      // What Supabase does when the access token was refreshed.
      sdk.created[0]!.cookies.setAll(
        [{ name: 'sb-proj-auth-token', value: 'new', options: { path: '/' } }],
        {
          'Cache-Control': 'private, no-store',
        },
      );
      return { data: { claims: { sub: user.id } }, error: null };
    });
    const result = await supabaseAdapter().refreshSession!(req('sb-proj-auth-token=old'));
    expect(result.signedIn).toBe(true);
    expect(result.response.cookies.get('sb-proj-auth-token')?.value).toBe('new');
    expect(result.response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('is signed out when the claims are missing or invalid', async () => {
    sdk.getClaims.mockResolvedValue({ data: null, error: { message: 'invalid jwt' } });
    const result = await supabaseAdapter().refreshSession!(req('sb-proj-auth-token.0=junk'));
    expect(result.signedIn).toBe(false);
  });
});
