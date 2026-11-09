'use client';

import * as React from 'react';

import { cn } from '../lib/utils';
import { Avatar } from './avatar';
import { Button } from './button';
import { CameraPlusIcon, TrashIcon } from './icons';

/**
 * Pick a profile picture: shows the current image (or initials), a "Choose photo" button and
 * "Remove". It validates type and size in the browser and hands the File to `onChange`; it never
 * uploads (the caller sends the file to storage through an action). `src` is the saved image URL.
 */
function AvatarUpload({
  name,
  src,
  onChange,
  accept = 'image/png,image/jpeg,image/webp',
  maxBytes = 5 * 1024 * 1024,
  disabled,
  className,
}: {
  /** The person's name: initials fallback and accessible text. */
  name: string;
  /** The saved picture's URL, if any. */
  src?: string | null;
  /** A chosen file, or null for "remove". */
  onChange: (file: File | null) => void;
  accept?: string;
  maxBytes?: number;
  disabled?: boolean;
  className?: string;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const errorId = React.useId();

  React.useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const shown = preview ?? src ?? null;
  const pick = (file: File | undefined) => {
    if (!file) return;
    const allowed = accept.split(',').map((a) => a.trim());
    if (
      !allowed.some((a) =>
        a.endsWith('/*') ? file.type.startsWith(a.slice(0, -1)) : file.type === a,
      )
    ) {
      return setError('Choose a PNG, JPG or WebP image.');
    }
    if (file.size > maxBytes) {
      return setError(
        `That image is too large. The limit is ${Math.round(maxBytes / 1024 / 1024)} MB.`,
      );
    }
    setError(null);
    setPreview(URL.createObjectURL(file));
    onChange(file);
  };

  return (
    <div
      data-slot="avatar-upload"
      className={cn('flex min-w-0 flex-wrap items-center gap-4', className)}
    >
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local blob preview or a storage URL; the UI package has no next/image
        <img
          src={shown}
          alt={`${name}'s picture`}
          className="size-16 shrink-0 rounded-full object-cover ring ring-border"
        />
      ) : (
        <Avatar name={name} className="size-16 text-lg" />
      )}
      <div className="grid min-w-0 gap-1.5">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={disabled} onClick={() => input.current?.click()}>
            <CameraPlusIcon /> {shown ? 'Change photo' : 'Choose photo'}
          </Button>
          {shown && (
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => {
                setPreview(null);
                setError(null);
                onChange(null);
              }}
            >
              <TrashIcon /> Remove
            </Button>
          )}
        </div>
        <p
          id={errorId}
          role={error ? 'alert' : undefined}
          className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}
        >
          {error ?? 'PNG, JPG or WebP, up to 5 MB.'}
        </p>
      </div>
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        className="hidden"
        aria-label={`Upload a picture for ${name}`}
        aria-describedby={errorId}
        disabled={disabled}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export { AvatarUpload };
