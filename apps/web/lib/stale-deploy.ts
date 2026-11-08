'use client';

import { toast } from '@app/ui/components/toaster';
import { unstable_isUnrecognizedActionError } from 'next/navigation';

/**
 * A tab opened before a deploy still runs the old build. Its server-action ids
 * no longer exist on the new server, so the next call (e.g. the notification
 * bell's minute-by-minute check) fails with Next's UnrecognizedActionError.
 * That isn't a bug to report: the page just needs reloading. Vercel Skew
 * Protection (OWNER_TODO.md) keeps old tabs working for a while; this covers
 * tabs older than that.
 */
export function isStaleDeploy(error: unknown): boolean {
  return (
    unstable_isUnrecognizedActionError(error) ||
    (error instanceof Error && error.name === 'UnrecognizedActionError')
  );
}

let shown = false;

/** Ask (once per tab) to reload onto the new version. */
export function promptReload(): void {
  if (shown) return;
  shown = true;
  toast('A new version of the app is available', {
    description: 'Reload to keep working. Anything you were typing may need re-entering.',
    duration: Infinity,
    action: { label: 'Reload', onClick: () => window.location.reload() },
  });
}
