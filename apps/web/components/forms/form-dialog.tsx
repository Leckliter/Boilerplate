'use client';

import { Button, type ButtonProps } from '@app/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@app/ui/components/dialog';
import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

type DialogControl = { close: () => void };
const FormDialogContext = createContext<DialogControl | null>(null);

/** Inside a <FormDialog>: closes it. Used by <ActionForm> after a save, and by Cancel buttons. */
export function useCloseDialog() {
  return useContext(FormDialogContext)?.close;
}

/**
 * An "Add …" / "Edit …" button (put it in a page's `actions`) that opens a dialog holding a form.
 * The dialog closes and resets when the enclosed <ActionForm> saves.
 *
 *   <FormDialog title="New project" trigger="New project" icon={<PlusIcon />} triggerVariant="primary">
 *     <ActionForm action="projects.create">…</ActionForm>
 *   </FormDialog>
 */
export function FormDialog({
  title,
  description,
  trigger,
  icon,
  triggerVariant = 'secondary',
  triggerSize,
  size,
  children,
}: {
  title: string;
  description?: ReactNode;
  /** The button label. */
  trigger: ReactNode;
  icon?: ReactNode;
  triggerVariant?: ButtonProps['variant'];
  triggerSize?: ButtonProps['size'];
  size?: 'sm' | 'base' | 'lg' | 'xl';
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Remount the form on every open so it starts empty and stale errors are gone.
  const [generation, setGeneration] = useState(0);
  const control = useMemo<DialogControl>(() => ({ close: () => setOpen(false) }), []);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setGeneration((g) => g + 1);
      }}
    >
      <DialogTrigger
        render={
          <Button variant={triggerVariant} size={triggerSize} icon={icon}>
            {trigger}
          </Button>
        }
      />
      <DialogContent size={size}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <FormDialogContext.Provider value={control} key={generation}>
          {children}
        </FormDialogContext.Provider>
      </DialogContent>
    </Dialog>
  );
}
