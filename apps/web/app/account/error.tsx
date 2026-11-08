'use client';

import { AreaError } from '@/components/layout/area-error';

/** A page in this area crashed: the error screen renders INSIDE the shell, so the rest of the app stays usable. */
export default function AccountError({ error, retry }: { error: unknown; retry: () => void }) {
  return <AreaError error={error} retry={retry} back={{ href: '/account', label: 'Account' }} />;
}
