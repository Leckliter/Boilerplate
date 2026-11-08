'use client';

import { Switch } from '@app/ui/components/switch';

import { useAction } from '@/lib/use-action';

/** The kill switch of one integration (`integrations.update`). Configuration itself comes from environment variables. */
export function IntegrationSwitch({
  id,
  label,
  enabled,
}: {
  id: string;
  label: string;
  enabled: boolean;
}) {
  const { run, pending } = useAction();
  return (
    <Switch
      aria-label={`${label} enabled`}
      checked={enabled}
      disabled={pending}
      onCheckedChange={(next: boolean) =>
        void run(
          'integrations.update',
          { id, enabled: next },
          { success: next ? `${label} on` : `${label} off` },
        )
      }
    />
  );
}
