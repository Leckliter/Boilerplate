import { callAction } from '@app/core';
import { deletionStatus } from '@app/core/account-data';
import { Callout } from '@app/ui/components/callout';
import { getServerDates } from '@/lib/dates-server';
import Link from 'next/link';

import type { SignedInViewer } from '@/lib/viewer';

/**
 * Shown across the whole portal while the person's account is scheduled for deletion (`account.deletionStatus`),
 * so it is never a surprise. A failing status check just shows nothing.
 */
export async function DeletionBanner({ viewer }: { viewer: SignedInViewer }) {
  const { formatDate } = await getServerDates();
  const status = await callAction(deletionStatus, {}, viewer.actor);
  if (!status.ok || !status.data.pending) return null;
  return (
    <Callout tone="warning" className="mb-6 flex flex-wrap items-center justify-between gap-2">
      <span>
        Your account will be deleted on{' '}
        <strong>{formatDate(status.data.pending.scheduledFor)}</strong>.
      </span>
      <Link href="/account/privacy" className="font-medium underline underline-offset-4">
        Keep my account
      </Link>
    </Callout>
  );
}
