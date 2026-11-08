'use client';

import { toast } from '@app/ui/components/toaster';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import type { ActionName } from './action-names';
import { invokeAction } from './invoke';
import { isStaleDeploy, promptReload } from './stale-deploy';

export type RunResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string; ref?: string; details?: unknown };

/** Toast an action failure; a bug (it has a reference) stays longer and offers "Copy reference". */
export function toastActionError(message: string, ref?: string) {
  toast.error(ref ? `${message} Error reference: ${ref}` : message, {
    ...(ref && {
      duration: 30_000,
      action: {
        label: 'Copy reference',
        // Clipboard can be denied by the browser; the reference is still on screen.
        onClick: () => void navigator.clipboard?.writeText(ref).catch(() => {}),
      },
    }),
  });
}

/**
 * Client hook for running an action from a button or any non-form UI:
 *
 *   const { run, pending } = useAction();
 *   await run('contacts.addTags', { id, tags: ['customer'] }, { success: 'Tagged' });
 *
 * Toasts on failure (and on success when you pass a message) and refreshes the page's server data.
 */
export function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run<T = unknown>(
    name: ActionName,
    input: unknown,
    opts: {
      success?: string;
      refresh?: boolean;
      /** Return true for a failure the caller handles itself (no toast), e.g. "book anyway?". */
      handles?: (error: { code: string; details?: unknown }) => boolean;
    } = {},
  ): Promise<RunResult<T>> {
    return new Promise((resolve) =>
      start(async () => {
        let res: Awaited<ReturnType<typeof invokeAction>>;
        try {
          res = await invokeAction(name, input);
        } catch (err) {
          // The tab is older than the deployed app: nothing ran, ask to reload.
          if (!isStaleDeploy(err)) throw err;
          promptReload();
          resolve({ ok: false, message: 'A new version of the app is available. Reload to continue.' });
          return;
        }
        if (!res.ok) {
          const e = res.error;
          if (!opts.handles?.(e)) toastActionError(e.message, e.ref);
          resolve({ ok: false, message: e.message, code: e.code, ref: e.ref, details: e.details });
          return;
        }
        if (opts.success) toast.success(opts.success);
        if (opts.refresh !== false) router.refresh();
        resolve({ ok: true, data: res.data as T });
      }),
    );
  }

  return { run, pending };
}
