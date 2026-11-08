'use client';

import { ErrorScreen } from '@/components/error-screen';

/** Any page that crashes (below the root layout) and has no nearer error.tsx shows this. */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} />;
}
