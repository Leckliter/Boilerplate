'use client';

import type { ReactNode } from 'react';

import { createKumoToastManager, Toasty, type KumoToastVariant } from './toast';

/*
 * The app-wide toast helper, on Kumo's Toast. Mount <Toaster /> once in the root layout,
 * then call `toast.success('Saved')` / `toast.error(…)` from any client code (events, effects, callbacks).
 */

const manager = createKumoToastManager();

type ToastOptions = {
  /** Second line, smaller. */
  description?: ReactNode;
  /** Pass the same id again to bump the visible toast instead of stacking a copy. */
  id?: string;
  /** Milliseconds before it goes away (0 = stays until dismissed). Errors stay longer by default. */
  duration?: number;
  /** A button on the toast: `{ label: 'Undo', onClick }`. */
  action?: { label: string; onClick: () => void };
};

function show(variant: KumoToastVariant, message: ReactNode, opts: ToastOptions = {}) {
  return manager.add({
    id: opts.id,
    title: message,
    description: opts.description,
    variant,
    timeout: opts.duration ?? (variant === 'error' ? 8000 : 5000),
    actions: opts.action
      ? [{ children: opts.action.label, variant: 'secondary', onClick: opts.action.onClick }]
      : undefined,
  });
}

/** `toast('Saved')`, or `toast.success|error|warning|info|message(message, options)`. Returns the toast id. */
const toast = Object.assign(
  (message: ReactNode, opts?: ToastOptions) => show('default', message, opts),
  {
    success: (message: ReactNode, opts?: ToastOptions) => show('success', message, opts),
    error: (message: ReactNode, opts?: ToastOptions) => show('error', message, opts),
    warning: (message: ReactNode, opts?: ToastOptions) => show('warning', message, opts),
    info: (message: ReactNode, opts?: ToastOptions) => show('info', message, opts),
    /** A plain neutral toast (what sonner called `toast.message`). */
    message: (message: ReactNode, opts?: ToastOptions) => show('default', message, opts),
    /** Remove a toast (or all of them with no id). */
    dismiss: (id?: string) => manager.close(id),
  },
);

/** Mount once in the root layout. (`theme` is accepted for old call sites; colours follow the page.) */
function Toaster(_props: { theme?: 'light' | 'dark' | 'system' }) {
  return <Toasty toastManager={manager} />;
}

export { toast, Toaster };
