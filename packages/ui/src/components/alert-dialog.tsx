'use client';

import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { useId, useState, useSyncExternalStore } from 'react';

import { cn } from '../lib/utils';
import { Button } from './button';
import { DIALOG_BACKDROP } from './dialog';
import { Input, Textarea } from './input';
import { Field } from './label';

/*
 * Confirmations and quick questions ("Delete this note?", "Why is it
 * cancelled?"). Kumo's alert dialog (Base UI AlertDialog: no close X, no
 * click-outside dismiss, sits near the top) with shadcn/ui part names.
 *
 * Most code doesn't need the parts: mount <DialogsHost /> once (root layout)
 * and call `confirm()`, `prompt()` or `alert()` — never `window.confirm`.
 */

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const alertDialogContentVariants = cva(
  [
    'fixed top-8 left-1/2 z-50 grid max-h-[calc(100dvh-4rem)] w-full max-w-[calc(100vw-2rem)] -translate-x-1/2 gap-4 overflow-y-auto sm:top-16',
    'rounded-xl bg-card p-6 text-foreground shadow-lg ring ring-border outline-none',
    'transition-[scale,opacity] duration-150 data-ending-style:scale-90 data-ending-style:opacity-0 data-starting-style:scale-90 data-starting-style:opacity-0',
  ],
  {
    variants: {
      size: { sm: 'sm:w-72', base: 'sm:w-96', lg: 'sm:w-[32rem]', xl: 'sm:w-[48rem]' },
    },
    defaultVariants: { size: 'base' },
  },
);

function AlertDialogContent({
  className,
  size,
  ...props
}: AlertDialogPrimitive.Popup.Props & VariantProps<typeof alertDialogContentVariants>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Backdrop className={DIALOG_BACKDROP} />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        className={cn(alertDialogContentVariants({ size }), className)}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('grid gap-1.5', className)} {...props} />;
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-wrap justify-end gap-2 pt-2', className)} {...props} />;
}

function AlertDialogTitle({ className, ...props }: AlertDialogPrimitive.Title.Props) {
  return (
    <AlertDialogPrimitive.Title
      className={cn('text-lg leading-tight font-semibold', className)}
      {...props}
    />
  );
}

function AlertDialogDescription({ className, ...props }: AlertDialogPrimitive.Description.Props) {
  return (
    <AlertDialogPrimitive.Description
      className={cn('text-sm whitespace-pre-line text-muted-foreground', className)}
      {...props}
    />
  );
}

/** Closes the dialog. Secondary button by default (Kumo: Cancel comes first). */
function AlertDialogCancel({
  children = 'Cancel',
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'type'>) {
  return (
    <AlertDialogPrimitive.Close
      render={(p) => (
        <Button type="button" variant="secondary" {...p} {...props}>
          {children}
        </Button>
      )}
    />
  );
}

/** The confirming button. Destructive by default; say what happens ("Delete note"). */
function AlertDialogAction({
  variant = 'destructive',
  ...props
}: React.ComponentProps<typeof Button>) {
  return <Button variant={variant} {...props} />;
}

// ---------------------------------------------------------------------------
// confirm() / prompt() / alert(): promise-based, like window.* but in the app's look.

type Tone = 'destructive' | 'primary';

type ConfirmOptions = {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** What the button does: "Delete note", "Cancel order". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** destructive (default) for delete/cancel/revoke; primary for anything else. */
  tone?: Tone;
};

type PromptOptions = ConfirmOptions & {
  label: string;
  defaultValue?: string;
  placeholder?: string;
  hint?: React.ReactNode;
  multiline?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  /** 'date' shows a date picker; the answer is YYYY-MM-DD. */
  type?: 'text' | 'date';
  /** Leave the box empty allowed? Default false. */
  optional?: boolean;
  /** Return a message to show under the box, or null if the value is fine. */
  validate?: (value: string) => string | null;
};

type AlertOptions = { title: React.ReactNode; description?: React.ReactNode; okLabel?: string };

type Request =
  | { id: number; kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { id: number; kind: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void }
  | { id: number; kind: 'alert'; opts: AlertOptions; resolve: () => void };

let queue: Request[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const push = (r: Request) => {
  queue = [...queue, r];
  emit();
};
const finish = (id: number) => {
  queue = queue.filter((r) => r.id !== id);
  emit();
};

/** Ask "are you sure?". Resolves true when confirmed. */
function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => push({ id: nextId++, kind: 'confirm', opts, resolve }));
}

/** Ask for a short answer. Resolves the trimmed text, or null when cancelled. */
function prompt(opts: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => push({ id: nextId++, kind: 'prompt', opts, resolve }));
}

/** Tell the person something they must acknowledge (prefer a toast when they needn't). */
function alert(opts: AlertOptions): Promise<void> {
  return new Promise((resolve) => push({ id: nextId++, kind: 'alert', opts, resolve }));
}

/** Mount once (root layout). Shows the confirm()/prompt()/alert() dialogs, one at a time. */
function DialogsHost() {
  const current = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => queue[0],
    () => undefined,
  );
  if (!current) return null;
  return <HostedDialog key={current.id} request={current} />;
}

function HostedDialog({ request: r }: { request: Request }) {
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState(r.kind === 'prompt' ? (r.opts.defaultValue ?? '') : '');
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  // Settle the promise once, then let the close animation play before removing it.
  const settle = (answer: 'ok' | 'cancel') => {
    if (r.kind === 'confirm') r.resolve(answer === 'ok');
    else if (r.kind === 'prompt') r.resolve(answer === 'ok' ? value.trim() : null);
    else r.resolve();
    setOpen(false);
  };

  const submit = () => {
    if (r.kind === 'prompt') {
      const v = value.trim();
      const problem =
        !v && !r.opts.optional ? 'Fill this in, or press Cancel.' : (r.opts.validate?.(v) ?? null);
      if (problem) return setError(problem);
    }
    settle('ok');
  };

  const tone: Tone = r.kind === 'alert' ? 'primary' : (r.opts.tone ?? 'destructive');
  const okLabel =
    r.kind === 'alert' ? (r.opts.okLabel ?? 'OK') : (r.opts.confirmLabel ?? 'Confirm');

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && open) settle('cancel'); // Esc
      }}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) finish(r.id);
      }}
    >
      <AlertDialogContent size={r.kind === 'prompt' && r.opts.multiline ? 'lg' : 'base'}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{r.opts.title}</AlertDialogTitle>
            {r.opts.description && (
              <AlertDialogDescription>{r.opts.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          {r.kind === 'prompt' && (
            <Field label={r.opts.label} htmlFor={inputId} hint={r.opts.hint} error={error}>
              {r.opts.multiline ? (
                <Textarea
                  id={inputId}
                  rows={3}
                  autoFocus
                  value={value}
                  placeholder={r.opts.placeholder}
                  onChange={(e) => (setValue(e.target.value), setError(null))}
                />
              ) : (
                <Input
                  id={inputId}
                  autoFocus
                  value={value}
                  type={r.opts.type ?? 'text'}
                  inputMode={r.opts.inputMode}
                  placeholder={r.opts.placeholder}
                  onChange={(e) => (setValue(e.target.value), setError(null))}
                />
              )}
            </Field>
          )}
          <AlertDialogFooter>
            {r.kind !== 'alert' && (
              <AlertDialogCancel>{r.opts.cancelLabel ?? 'Cancel'}</AlertDialogCancel>
            )}
            <AlertDialogAction type="submit" variant={tone}>
              {okLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  alert,
  alertDialogContentVariants,
  confirm,
  DialogsHost,
  prompt,
};
