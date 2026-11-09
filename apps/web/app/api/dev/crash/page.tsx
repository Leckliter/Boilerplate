import { notFound } from 'next/navigation';

import { devLoginEnabled } from '@/lib/auth/dev';

/**
 * A PAGE that crashes while it renders on the server, for the e2e error-pipeline tests: the error
 * screen (app/error.tsx) shows its digest, and Next's `onRequestError` (instrumentation.ts) reports it.
 * Development only: 404 unless DEV_LOGIN is on outside a production build, like /api/dev/boom.
 */
export const dynamic = 'force-dynamic';

export default function ServerCrashPage() {
  if (!devLoginEnabled()) notFound();
  throw new Error('E2E server page crash');
}
