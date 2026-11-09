import { notFound } from 'next/navigation';

import { devLoginEnabled } from '@/lib/auth/dev';

import { Crash } from './crash';

/**
 * A page whose CLIENT component throws while it renders in the browser, for the e2e error-pipeline
 * tests: the error screen reports it to /api/errors and shows the `E-…` reference it gets back.
 * Development only (see ../page.tsx).
 */
export const dynamic = 'force-dynamic';

export default function ClientCrashPage() {
  if (!devLoginEnabled()) notFound();
  return <Crash />;
}
