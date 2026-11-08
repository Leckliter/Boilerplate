'use client';

import { Button } from '@app/ui/components/button';
import { PaperPlaneTiltIcon } from '@app/ui/components/icons';

import { useAction } from '@/lib/use-action';

/** "Send me a test": checks the person's settings work (`notifications.sendTest`). */
export function SendTestButton() {
  const { run, pending } = useAction();
  return (
    <Button
      loading={pending}
      icon={<PaperPlaneTiltIcon />}
      onClick={() =>
        run('notifications.sendTest', {}, { success: 'Test sent. Check your inbox and email.' })
      }
    >
      Send me a test
    </Button>
  );
}
