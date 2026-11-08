import 'server-only';

import { devAdapter, devLoginEnabled } from './dev';
import type { AuthAdapter } from './types';

export * from './types';

/**
 * The adapter for `BACKEND` (neon | supabase). To drop a provider (docs/choosing-a-backend.md) delete its
 * file and its branch here. Providers are imported lazily so the one you removed never has to exist.
 */
export async function getAuthAdapter(): Promise<AuthAdapter | null> {
  if (devLoginEnabled()) return devAdapter;
  if (!authConfigured()) return null;
  const backend = process.env.BACKEND ?? 'neon';
  if (backend === 'supabase') return (await import('./supabase')).supabaseAdapter();
  if (backend === 'neon') return (await import('./neon')).neonAdapter();
  throw new Error(`BACKEND must be "neon" or "supabase" (got "${backend}")`);
}

/** Is a sign-in provider configured at all? Without one the site still works; sign-in is just unavailable. */
export function authConfigured(): boolean {
  if (devLoginEnabled()) return true;
  return process.env.BACKEND === 'supabase'
    ? Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    : Boolean(process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET);
}
