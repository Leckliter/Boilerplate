'use client';

import { ErrorScreen } from '@/components/error-screen';

/** A public page crashed: the error screen shows INSIDE the site's header and footer, with its reference. */
export default function SiteError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} />;
}
