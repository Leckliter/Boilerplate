import { neonAuth } from '@/lib/auth/neon';

/**
 * Neon Auth's endpoints (session cookie, sign-in) proxied under /api/auth/*. Only used when
 * BACKEND=neon: with Supabase, delete this folder (docs/choosing-a-backend.md).
 */
type Ctx = { params: Promise<{ path: string[] }> };

export const GET = (req: Request, ctx: Ctx) => neonAuth().handler().GET(req, ctx);
export const POST = (req: Request, ctx: Ctx) => neonAuth().handler().POST(req, ctx);
