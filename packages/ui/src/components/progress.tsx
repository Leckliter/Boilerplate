'use client';

import { Progress as BaseProgress } from '@base-ui/react/progress';
import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '../lib/utils';

/**
 * Progress of a task (upload, import, setup). `value={null}` is indeterminate (still working, no
 * percentage). For a quantity against a limit (storage used) use Meter. Base UI Progress.
 */
type ProgressProps = Omit<ComponentPropsWithoutRef<typeof BaseProgress.Root>, 'children'> & {
  label: string;
  /** Show the percentage next to the label. Default true. */
  showValue?: boolean;
  tone?: 'brand' | 'success' | 'danger';
};

const TONE = { brand: 'bg-primary', success: 'bg-success', danger: 'bg-destructive' } as const;

function Progress({
  value,
  label,
  showValue = true,
  tone = 'brand',
  className,
  ...props
}: ProgressProps) {
  const indeterminate = value == null;
  return (
    <BaseProgress.Root
      data-slot="progress"
      value={value}
      {...props}
      className={cn('flex w-full flex-col gap-2', className)}
    >
      <div className="flex items-center justify-between gap-4">
        <BaseProgress.Label className="min-w-0 text-sm text-foreground">{label}</BaseProgress.Label>
        {showValue && !indeterminate && (
          <BaseProgress.Value className="text-sm text-muted-foreground tabular-nums" />
        )}
      </div>
      <BaseProgress.Track className="relative h-2 w-full overflow-hidden rounded-full bg-fill">
        <BaseProgress.Indicator
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none',
            TONE[tone],
            indeterminate && 'w-1/3 motion-safe:animate-[shimmer_1.2s_ease-in-out_infinite]',
          )}
        />
      </BaseProgress.Track>
    </BaseProgress.Root>
  );
}

export type { ProgressProps };
export { Progress };
