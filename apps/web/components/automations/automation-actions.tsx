'use client';

import { Button } from '@app/ui/components/button';
import { ArchiveIcon, CopyIcon, LightningIcon } from '@app/ui/components/icons';
import { Switch } from '@app/ui/components/switch';
import { useRouter } from 'next/navigation';

import { DeleteForm } from '@/components/forms/delete-form';
import { useAction } from '@/lib/use-action';

/** Turn an automation on or off (`automations.update`). */
export function EnabledSwitch({
  id,
  name,
  enabled,
}: {
  id: string;
  name: string;
  enabled: boolean;
}) {
  const { run, pending } = useAction();
  return (
    <Switch
      aria-label={`${name} is on`}
      label={enabled ? 'On' : 'Off'}
      checked={enabled}
      disabled={pending}
      onCheckedChange={(next: boolean) =>
        void run(
          'automations.update',
          { id, enabled: next },
          { success: next ? 'Turned on' : 'Turned off' },
        )
      }
    />
  );
}

/** Run now (a test: steps really run), duplicate, archive. */
export function AutomationButtons({ id, name }: { id: string; name: string }) {
  const { run, pending } = useAction();
  const router = useRouter();
  return (
    <>
      <Button
        icon={<LightningIcon />}
        loading={pending}
        onClick={async () => {
          const res = await run<{ status: string; reason?: string; runId?: string }>(
            'automations.run',
            { id },
            { success: 'Started a test run. Steps really run.' },
          );
          if (res.ok && res.data.runId) router.push(`/admin/automations/runs/${res.data.runId}`);
        }}
      >
        Run now
      </Button>
      <Button
        icon={<CopyIcon />}
        loading={pending}
        onClick={async () => {
          const res = await run<{ id: string }>(
            'automations.duplicate',
            { id },
            { success: 'Copied (it starts off)' },
          );
          if (res.ok) router.push(`/admin/automations/${res.data.id}`);
        }}
      >
        Duplicate
      </Button>
      <DeleteForm
        action="automations.archive"
        input={{ id }}
        label="Archive"
        icon={<ArchiveIcon />}
        title={`Archive “${name}”?`}
        description="It turns off for good and any runs still going are cancelled. Its history is kept."
        confirmLabel="Archive"
        success="Archived"
        redirectTo="/admin/automations"
      />
    </>
  );
}

/** Cancel a run that is going, or retry one that failed (`automations.cancelRun`, `automations.retryRun`). */
export function RunButtons({ id, status }: { id: string; status: string }) {
  const { run, pending } = useAction();
  if (status === 'failed') {
    return (
      <Button
        loading={pending}
        onClick={() =>
          run('automations.retryRun', { id }, { success: 'Retrying at the step that failed' })
        }
      >
        Retry
      </Button>
    );
  }
  if (status === 'running' || status === 'waiting') {
    return (
      <Button
        loading={pending}
        onClick={() => run('automations.cancelRun', { id }, { success: 'Cancelled' })}
      >
        Cancel run
      </Button>
    );
  }
  return null;
}
