'use client';

import * as React from 'react';

import { cn } from '../lib/utils';
import { CheckIcon, PencilSimpleIcon, XIcon } from './icons';
import { inputVariants } from './input';

/**
 * Click a value to edit it where it is (a title, a nickname). Enter or the tick saves, Escape or
 * the cross cancels. `onSave` may be async: a thrown error keeps the field open and shows its
 * message. For a whole record section use EditableCard.
 */
function InlineEdit({
  value,
  onSave,
  label,
  placeholder = 'Add…',
  validate,
  className,
}: {
  value: string;
  /** Save the new value. Throw an Error with a plain message to refuse it. */
  onSave: (value: string) => void | Promise<void>;
  /** Accessible name of the value ("Project name"). */
  label: string;
  placeholder?: string;
  /** Return a message to block saving. */
  validate?: (value: string) => string | null;
  className?: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const errorId = React.useId();

  const start = () => {
    setDraft(value);
    setError(null);
    setEditing(true);
  };
  const cancel = () => setEditing(false);
  const save = async () => {
    const next = draft.trim();
    const problem = validate?.(next) ?? null;
    if (problem) return setError(problem);
    if (next === value) return setEditing(false);
    setBusy(true);
    try {
      await onSave(next);
      setEditing(false);
    } catch (e) {
      // An expected refusal (ActionError) carries a plain message; show it and keep the field open.
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={start}
        aria-label={`Edit ${label}`}
        data-slot="inline-edit"
        className={cn(
          'group inline-flex max-w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left outline-none hover:bg-tint focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        <span className={cn('min-w-0 break-words', !value && 'text-muted-foreground')}>
          {value || placeholder}
        </span>
        <PencilSimpleIcon
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100"
        />
      </button>
    );
  }
  return (
    <div data-slot="inline-edit" className={cn('grid min-w-0 gap-1', className)}>
      <div className="flex min-w-0 items-center gap-1">
        <input
          autoFocus
          aria-label={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          value={draft}
          disabled={busy}
          onChange={(e) => (setDraft(e.target.value), setError(null))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void save();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancel();
            }
          }}
          className={cn(
            inputVariants({
              size: 'sm',
              variant: error ? 'error' : 'default',
              focusIndicator: true,
            }),
            'min-w-0 flex-1',
          )}
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          aria-label="Save"
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-success outline-none hover:bg-tint focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <CheckIcon aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          aria-label="Cancel"
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-tint focus-visible:ring-2 focus-visible:ring-ring"
        >
          <XIcon aria-hidden className="size-4" />
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export { InlineEdit };
