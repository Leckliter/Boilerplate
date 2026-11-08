import type { NextRequest, NextResponse } from 'next/server';

/** Who the auth provider says is signed in. The contact (roles, name) is found from this in lib/viewer.ts. */
export type AuthSession = {
  /** The provider's user id (a uuid on Supabase, a Better Auth id on Neon). Stored in `contacts.auth_user_id` (TEXT). */
  userId: string;
  email: string;
  emailVerified: boolean;
  name?: string | null;
};

/** A failure the person should read ("That code is wrong or expired."). `code` is the provider's, for the log. */
export class AuthFailure extends Error {
  constructor(
    message: string,
    public readonly code: string = 'auth_failed',
  ) {
    super(message);
    this.name = 'AuthFailure';
  }
}

/**
 * The ONE interface that differs between Neon and Supabase (docs/choosing-a-backend.md). Only the
 * adapter files import a provider SDK, and only for sign-in: data never goes through the provider.
 * Sign-in is passwordless: an emailed code (or magic link on Supabase).
 */
export interface AuthAdapter {
  /** The signed-in user for this request, or null. Asks the provider (not just the cookie). */
  getSession(): Promise<AuthSession | null>;
  /** Email a sign-in code. Creates the login on first use (the contact is linked/created in viewer.ts). */
  sendEmailCode(email: string): Promise<void>;
  /** Exchange the emailed code for a session cookie. Throws `AuthFailure` for a wrong/expired code. */
  verifyEmailCode(email: string, code: string): Promise<AuthSession>;
  signOut(): Promise<void>;
  /** Email-link landing (`/auth/confirm`): provider-specific; omit when the provider has no links. */
  confirmLink?(params: { tokenHash: string; type: string }): Promise<AuthSession>;
  /** `proxy.ts`: refresh the session cookie and say whether the request is signed in. */
  refreshSession?(request: NextRequest): Promise<{ signedIn: boolean; response: NextResponse }>;
}
