'use client';

import { PencilIcon } from './icons';
import type * as React from 'react';
import { useEffect, useId, useRef, useState } from 'react';

import { confirm } from './alert-dialog';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';

/** Fired when a card opens for editing, so other open cards with no changes close. */
const OPEN_EVENT = 'app:editable-card-open';

/**
 * One section of a record (contact info, product details…). Shows `view`
 * (usually a DetailList) until someone with access presses Edit; then the
 * card body becomes a form with `children` as its fields, plus Save / Cancel.
 *
 * `onSave` gets the form's data and returns true when it saved — the card then
 * goes back to view mode (the page refresh shows the new values). Return false
 * to stay in edit mode (the action's toast has already said what's wrong).
 *
 * Esc cancels. Leaving the page or cancelling with unsaved changes asks first.
 */
function EditableCard({
  title,
  description,
  view,
  children,
  onSave,
  canEdit = true,
  editLabel = 'Edit',
  saveLabel = 'Save changes',
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  view: React.ReactNode;
  /** The form fields shown while editing (each in a `<Field>`). */
  children: React.ReactNode;
  onSave: (form: FormData) => Promise<boolean>;
  canEdit?: boolean;
  editLabel?: string;
  saveLabel?: string;
  className?: string;
}) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  function close() {
    setEditing(false);
    setDirty(false);
    // Put focus back where the person started, for keyboard users.
    requestAnimationFrame(() => editButtonRef.current?.focus());
  }

  async function cancel() {
    if (
      dirty &&
      !(await confirm({
        title: 'Discard your changes?',
        description: 'What you typed in this card isn’t saved yet.',
        confirmLabel: 'Discard changes',
        cancelLabel: 'Keep editing',
      }))
    )
      return;
    close();
  }

  // Focus the first field on open, and tell other cards we're editing.
  useEffect(() => {
    if (!editing) return;
    formRef.current
      ?.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea')
      ?.focus();
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
  }, [editing, id]);

  // Another card opened: close this one if nothing has been typed in it.
  useEffect(() => {
    if (!editing || dirty) return;
    const onOpen = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) setEditing(false);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [editing, dirty, id]);

  // Unsaved changes: the browser asks before closing or reloading the tab.
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);

  return (
    <Card data-slot="editable-card" data-editing={editing || undefined} className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {canEdit && !editing && (
          <Button
            ref={editButtonRef}
            type="button"
            size="xs"
            variant="ghost"
            className="-my-1"
            onClick={() => setEditing(true)}
          >
            <PencilIcon />
            {editLabel}
          </Button>
        )}
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {editing ? (
          <form
            ref={formRef}
            className="grid gap-4"
            onChange={() => setDirty(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                void cancel();
              }
            }}
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              try {
                if (await onSave(new FormData(e.currentTarget))) close();
              } finally {
                setSaving(false);
              }
            }}
          >
            <fieldset disabled={saving} className="grid min-w-0 gap-4">
              {children}
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => void cancel()}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  {saving ? 'Saving…' : saveLabel}
                </Button>
              </div>
            </fieldset>
          </form>
        ) : (
          view
        )}
      </CardContent>
    </Card>
  );
}

export { EditableCard };
