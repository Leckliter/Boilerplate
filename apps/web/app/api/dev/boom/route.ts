import { reportError } from '@app/core';
import { NextResponse } from 'next/server';

import { devLoginEnabled } from '@/lib/auth/dev';

/**
 * GET /api/dev/boom — a server error on demand, for the e2e error-pipeline tests. Development only:
 * 404 unless DEV_LOGIN is on outside a production build (lib/auth/dev.ts), exactly like /api/dev-login.
 *
 *   ?kind=report  (default) reports an error itself and answers 500 `{ ref }` with its E-… reference
 *   ?kind=throw   throws, so Next's `onRequestError` (instrumentation.ts) reports it; answers 500
 *
 * `?message=` sets the error text so a test can find its own report.
 */
export async function GET(request: Request) {
  if (!devLoginEnabled()) return new NextResponse('Not found', { status: 404 });
  const { searchParams } = new URL(request.url);
  const message = searchParams.get('message')?.slice(0, 200) || 'E2E boom';
  if (searchParams.get('kind') === 'throw') throw new Error(message);
  const ref = await reportError(new Error(message), { source: 'request', method: 'GET' });
  return NextResponse.json({ ok: false, ref }, { status: 500 });
}
