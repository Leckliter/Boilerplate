'use client';

import { buttonVariants } from '@app/ui/components/button';
import { ArrowLeftIcon } from '@app/ui/components/icons';
import Link from 'next/link';

import { ErrorScreen } from '@/components/error-screen';

/**
 * What a page inside the admin or account shell shows when it crashes: the error screen INSIDE the
 * shell (rail, header, tabs stay), so one broken page never takes the whole app down. Used by the
 * `error.tsx` of each area. Next keys it on the route, so moving to another page starts clean. `retry` re-fetches and re-renders.
 */
export function AreaError({
  error,
  retry,
  back,
}: {
  error: unknown;
  retry: () => void;
  back: { href: string; label: string };
}) {
  return (
    <div className="grid justify-items-center gap-4 py-8">
      <ErrorScreen error={error} retry={retry} area />
      <Link href={back.href} className={buttonVariants({ variant: 'ghost' })}>
        <ArrowLeftIcon /> {back.label}
      </Link>
    </div>
  );
}
