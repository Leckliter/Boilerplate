'use client';

import { UploadSimpleIcon } from './icons';
import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * A place to drop or pick files: a dashed box that opens the file picker on
 * click (or Enter/Space) and accepts drag-and-drop. It only hands over the
 * chosen files (`onFiles`) — uploading is the caller's job. On phones,
 * `capture` lets "Take photo" open the camera directly.
 */
function FileDrop({
  onFiles,
  accept,
  multiple = true,
  disabled,
  capture,
  label = 'Drop files here or click to choose',
  hint,
  className,
}: {
  onFiles: (files: File[]) => void;
  /** e.g. "image/*,application/pdf" */
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  capture?: 'environment' | 'user';
  label?: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  const take = (list: FileList | null) => {
    const picked = list ? [...list] : [];
    if (picked.length && !disabled) onFiles(multiple ? picked : picked.slice(0, 1));
  };
  return (
    <div
      data-slot="file-drop"
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      onClick={() => !disabled && input.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault();
          input.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={(e) => {
        // Moving onto a child element also fires dragleave; only clear when really leaving.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files);
      }}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-input bg-card px-4 py-6 text-center text-sm transition-colors outline-none hover:bg-accent/50 focus-visible:ring-[1.5px] focus-visible:ring-ring',
        over && 'border-primary bg-accent',
        disabled && 'cursor-not-allowed opacity-60 hover:bg-card',
        className,
      )}
    >
      <UploadSimpleIcon className="size-5 text-muted-foreground" aria-hidden />
      <span className="font-medium">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      <input
        ref={input}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        capture={capture}
        disabled={disabled}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export { FileDrop };
