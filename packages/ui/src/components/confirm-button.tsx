'use client';

import * as React from 'react';

import { confirm } from './alert-dialog';
import { Button } from './button';

/**
 * A button that asks first. Click → the app's confirm dialog → `onConfirm` only on "yes".
 * Defaults to the destructive look; pass `tone="primary"` for a non-destructive question.
 * Needs `<DialogsHost />` in the root layout (it is, in apps/web).
 *
 *   <ConfirmButton title="Delete this note?" confirmLabel="Delete note" onConfirm={remove}>Delete</ConfirmButton>
 */
type ConfirmButtonProps = Omit<React.ComponentProps<typeof Button>, 'onClick' | 'title'> & {
  /** The question: "Delete this note?" */
  title: React.ReactNode;
  description?: React.ReactNode;
  /** What the confirm button does: "Delete note". */
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'destructive' | 'primary';
  /** Runs after a yes. A rejected promise is not swallowed: handle or report it in the caller. */
  onConfirm: () => void | Promise<void>;
};

function ConfirmButton({
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'destructive',
  onConfirm,
  variant,
  disabled,
  ...props
}: ConfirmButtonProps) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      variant={variant ?? (tone === 'destructive' ? 'secondary-destructive' : 'secondary')}
      disabled={disabled || busy}
      onClick={async () => {
        const yes = await confirm({ title, description, confirmLabel, cancelLabel, tone });
        if (!yes) return;
        setBusy(true);
        try {
          await onConfirm();
        } finally {
          setBusy(false);
        }
      }}
      {...props}
    />
  );
}

export type { ConfirmButtonProps };
export { ConfirmButton };
