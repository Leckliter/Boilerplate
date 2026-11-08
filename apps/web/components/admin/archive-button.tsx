'use client';

import { Button } from '@app/ui/components/button';
import { ArchiveIcon, ArrowCounterClockwiseIcon } from '@app/ui/components/icons';

import { useAction } from '@/lib/use-action';

export function ArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const { run, pending } = useAction();
  return archived ? (
    <Button
      size="sm"
      disabled={pending}
      onClick={() => run('contacts.restore', { id }, { success: 'Restored' })}
    >
      <ArrowCounterClockwiseIcon /> Restore
    </Button>
  ) : (
    <Button
      size="sm"
      disabled={pending}
      onClick={() => run('contacts.archive', { id }, { success: 'Archived' })}
    >
      <ArchiveIcon /> Archive
    </Button>
  );
}
