'use client';

import { CheckCircleIcon, UploadSimpleIcon, WarningCircleIcon } from './icons';
import { Progress } from './progress';
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
  status = 'idle',
  progress,
  message,
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
  /**
   * The upload state, set by the caller: `uploading` shows the progress bar (`progress` 0–100, or
   * leave undefined for "working"), `success` and `error` show `message` (announced to screen
   * readers) and the zone stays usable to try again. Dropping/choosing files is blocked while uploading.
   */
  status?: 'idle' | 'uploading' | 'success' | 'error';
  progress?: number;
  message?: React.ReactNode;
  className?: string;
}) {
  const uploading = status === 'uploading';
  disabled = disabled || uploading;
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
        status === 'success' && 'border-success bg-success-tint',
        status === 'error' && 'border-destructive bg-destructive-tint',
        disabled && 'cursor-not-allowed opacity-60 hover:bg-card',
        className,
      )}
    >
      {status === 'success' ? (
        <CheckCircleIcon className="size-5 text-success" aria-hidden />
      ) : status === 'error' ? (
        <WarningCircleIcon className="size-5 text-destructive" aria-hidden />
      ) : (
        <UploadSimpleIcon className="size-5 text-muted-foreground" aria-hidden />
      )}
      <span className="font-medium">{uploading ? 'Uploading…' : label}</span>
      {uploading && (
        <Progress
          className="max-w-xs"
          label="Upload progress"
          value={progress ?? null}
          max={100}
          showValue={progress != null}
        />
      )}
      {hint && !uploading && <span className="text-xs text-muted-foreground">{hint}</span>}
      <span
        role={status === 'error' ? 'alert' : 'status'}
        className={cn(
          'text-xs',
          status === 'error'
            ? 'text-destructive'
            : status === 'success'
              ? 'text-success'
              : 'sr-only',
        )}
      >
        {message}
      </span>
      <input
        ref={input}
        type="file"
        hidden
        tabIndex={-1}
        aria-hidden
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

/** The same component under its other common name. */
const DropZone = FileDrop;

export { DropZone, FileDrop };
