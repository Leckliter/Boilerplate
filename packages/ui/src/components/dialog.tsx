'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { XIcon } from './icons';
import type * as React from 'react';

import { cn } from '../lib/utils';

/** The dimmed layer behind a dialog or drawer (reuse it for custom popups). */
const DIALOG_BACKDROP =
  'fixed inset-0 z-50 bg-recessed opacity-80 transition-all duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0';

/** Kumo's dialog widths (from sm:). Leave `size` off for the default fluid width (max 32rem). */
const DIALOG_SIZES = {
  sm: 'sm:w-72',
  base: 'sm:w-96',
  lg: 'sm:w-[32rem]',
  xl: 'sm:w-[48rem]',
} as const;
type DialogSize = keyof typeof DIALOG_SIZES;

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

function DialogContent({
  className,
  children,
  showClose = true,
  size,
  ...props
}: DialogPrimitive.Popup.Props & { showClose?: boolean; size?: DialogSize }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className={DIALOG_BACKDROP} />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          // Kumo's dialog: near the top, ringed card, scales in and out.
          'fixed top-8 left-1/2 z-50 grid max-h-[calc(100dvh-4rem)] -translate-x-1/2 gap-4 overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl bg-card p-6 text-foreground shadow-lg ring ring-border outline-none sm:top-16 sm:max-h-[calc(100dvh-6rem)]',
          size
            ? cn('w-full max-w-[calc(100vw-2rem)]', DIALOG_SIZES[size])
            : 'w-[calc(100%-2rem)] max-w-lg',
          'transition-[scale,opacity] duration-150 data-ending-style:scale-90 data-ending-style:opacity-0 data-starting-style:scale-90 data-starting-style:opacity-0',
          className,
        )}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute top-4 right-4 flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-fill hover:text-foreground focus-visible:ring-[1.5px] focus-visible:ring-ring"
          >
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

/**
 * A panel that slides in from the side (phone menus, filters, a quick look).
 * Use inside <Dialog> instead of DialogContent.
 */
function SheetContent({
  className,
  children,
  side = 'left',
  title,
  ...props
}: DialogPrimitive.Popup.Props & { side?: 'left' | 'right'; title: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className={DIALOG_BACKDROP} />
      <DialogPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          'fixed inset-y-0 z-50 w-72 max-w-[85vw] overflow-y-auto bg-sidebar p-3 shadow-lg ring ring-border transition-transform duration-200 outline-none',
          side === 'left'
            ? 'left-0 data-ending-style:-translate-x-full data-starting-style:-translate-x-full'
            : 'right-0 data-ending-style:translate-x-full data-starting-style:translate-x-full',
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('grid gap-1.5 pr-6', className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return <DialogPrimitive.Title className={cn('text-lg font-semibold', className)} {...props} />;
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export type { DialogSize };
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DIALOG_BACKDROP,
  SheetContent,
};
