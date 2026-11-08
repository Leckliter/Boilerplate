'use client';

import { Button } from '@app/ui/components/button';
import { ArrowClockwiseIcon } from '@app/ui/components/icons';

import { useAction } from '@/lib/use-action';

/** Send a failed or skipped delivery again (`notifications.retry`). */
export function RetryDeliveryButton({ id }: { id: string }) {
  const { run, pending } = useAction();
  return (
    <Button
      size="sm"
      loading={pending}
      icon={<ArrowClockwiseIcon />}
      onClick={() => run('notifications.retry', { id }, { success: 'Queued to send again' })}
    >
      Retry
    </Button>
  );
}
