'use client';

import { Button } from '@app/ui/components/button';
import { ArrowClockwiseIcon, XIcon } from '@app/ui/components/icons';

import { useAction } from '@/lib/use-action';

/** Retry a failed/cancelled job, or cancel a waiting one (`jobs.retry`, `jobs.cancel`). */
export function JobButtons({ id, status }: { id: string; status: string }) {
  const { run, pending } = useAction();
  if (status === 'failed' || status === 'cancelled') {
    return (
      <Button
        size="sm"
        loading={pending}
        icon={<ArrowClockwiseIcon />}
        onClick={() => run('jobs.retry', { id }, { success: 'Queued to run again' })}
      >
        Retry
      </Button>
    );
  }
  if (status === 'pending') {
    return (
      <Button
        size="sm"
        loading={pending}
        icon={<XIcon />}
        onClick={() => run('jobs.cancel', { id }, { success: 'Cancelled' })}
      >
        Cancel
      </Button>
    );
  }
  return null;
}
