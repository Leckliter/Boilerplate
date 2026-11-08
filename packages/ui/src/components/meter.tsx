import { Meter as BaseMeter } from '@base-ui/react/meter';
import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '../lib/utils';

/* Meter: a labelled value bar (storage used, quota). Base UI Meter. */

type MeterProps = ComponentPropsWithoutRef<typeof BaseMeter.Root> & {
  /** The words above the bar. */
  label: string;
  /** Replaces the formatted value (e.g. "3 of 10 GB"). */
  customValue?: string;
  /** Show the value at the right of the label. Default true. */
  showValue?: boolean;
  trackClassName?: string;
  indicatorClassName?: string;
};

function Meter({
  value,
  customValue,
  label,
  showValue = true,
  className,
  trackClassName,
  indicatorClassName,
  ...props
}: MeterProps) {
  return (
    <BaseMeter.Root
      data-slot="meter"
      value={value}
      {...props}
      className={cn('flex w-full flex-col gap-2', className)}
    >
      <div className="flex items-center justify-between gap-4">
        <BaseMeter.Label className="min-w-0 text-xs text-muted-foreground">{label}</BaseMeter.Label>
        {customValue ? (
          <span className="text-sm font-medium text-foreground tabular-nums">{customValue}</span>
        ) : (
          showValue && (
            <BaseMeter.Value className="text-sm font-medium text-foreground tabular-nums" />
          )
        )}
      </div>
      <BaseMeter.Track
        className={cn('relative h-2 w-full overflow-hidden rounded-full bg-fill', trackClassName)}
      >
        <BaseMeter.Indicator
          className={cn(
            'absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-300 ease-out',
            indicatorClassName,
          )}
        />
      </BaseMeter.Track>
    </BaseMeter.Root>
  );
}

export type { MeterProps };
export { Meter };
