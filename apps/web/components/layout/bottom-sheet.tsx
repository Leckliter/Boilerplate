'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { DIALOG_BACKDROP } from '@app/ui/components/dialog';
import { cn } from '@app/ui/lib/utils';
import type { ComponentProps, ReactNode } from 'react';

/** A sheet that slides up from the bottom of a phone (the launcher, page options). Built on Base UI Dialog. */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
  className,
  onClick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
  onClick?: ComponentProps<'div'>['onClick'];
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className={DIALOG_BACKDROP} />
        <DialogPrimitive.Popup
          data-slot="bottom-sheet"
          onClick={onClick}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-xl bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-foreground shadow-lg ring ring-border outline-none',
            'transition-transform duration-200 data-ending-style:translate-y-full data-starting-style:translate-y-full',
            className,
          )}
        >
          <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-fill" />
          <DialogPrimitive.Title className="mb-2 text-sm font-semibold">{title}</DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
