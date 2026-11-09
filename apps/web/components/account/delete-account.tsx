'use client';

import { prompt } from '@app/ui/components/alert-dialog';
import { Button } from '@app/ui/components/button';
import { Callout } from '@app/ui/components/callout';
import { TrashIcon } from '@app/ui/components/icons';
import { formatDate } from '@app/ui/lib/dates';

import { useAction } from '@/lib/use-action';

/**
 * Delete my account (`account.requestDeletion` / `account.cancelDeletion`). Nothing is erased at once: after
 * the grace period the daily job wipes the personal data, and until then it can be cancelled. Asking
 * requires typing your own email address, so it can't happen by a stray click. While a request is pending
 * the page says when it will happen and offers Cancel.
 */
export function DeleteAccount({
  email,
  pending,
  graceDays,
}: {
  email: string;
  pending: { scheduledFor: string } | null;
  graceDays: number;
}) {
  const { run, pending: busy } = useAction();

  async function ask() {
    const typed = await prompt({
      title: 'Delete your account?',
      description: `Your name, email, phone, notification settings, files and API keys will be erased after ${graceDays} days, and you’ll be signed out everywhere. You can cancel any time before then.`,
      label: `Type ${email} to confirm`,
      confirmLabel: 'Delete my account',
      validate: (v) =>
        v.trim().toLowerCase() === email.toLowerCase() ? null : 'That isn’t your email address.',
    });
    if (typed === null) return;
    await run('account.requestDeletion', {}, { success: 'Deletion scheduled' });
  }

  if (pending) {
    return (
      <div className="grid gap-3">
        <Callout tone="warning">
          <span>
            Your account is scheduled to be deleted on{' '}
            <strong>{formatDate(pending.scheduledFor)}</strong>. Until then you can still sign in
            and change your mind.
          </span>
        </Callout>
        <div>
          <Button
            loading={busy}
            onClick={() => run('account.cancelDeletion', {}, { success: 'Deletion cancelled' })}
          >
            Keep my account
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        We wait {graceDays} days before erasing anything, so you can change your mind. The last
        owner of the app can’t delete their account.
      </p>
      <div>
        <Button variant="destructive" icon={<TrashIcon />} loading={busy} onClick={ask}>
          Delete my account
        </Button>
      </div>
    </div>
  );
}
