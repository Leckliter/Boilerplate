import { CheckIcon } from './icons';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Where someone is in a short step-by-step flow (checkout: details → terms → payment).
 * Done steps get a tick and, with `onStepClick`, can be clicked to go back; later steps
 * can't be jumped to. Phones show the numbers with only the current step's label.
 *
 *   <Steps steps={['Your details', 'Agreement', 'Payment']} current={1} onStepClick={setStep} />
 */
function Steps({
  steps,
  current,
  onStepClick,
  className,
  ...props
}: Omit<React.ComponentProps<'ol'>, 'children'> & {
  steps: string[];
  /** Index of the step being shown (0-based). */
  current: number;
  /** Go back to a done step. Leave out to make the steps plain text. */
  onStepClick?: (index: number) => void;
}) {
  return (
    <ol
      data-slot="steps"
      aria-label="Progress"
      className={cn('flex min-w-0 items-center gap-2 text-sm', className)}
      {...props}
    >
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const inner = (
          <>
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                done && 'border-primary bg-primary text-primary-foreground',
                active && 'border-primary text-primary',
                !done && !active && 'border-border text-muted-foreground',
              )}
            >
              {done ? <CheckIcon className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span
              className={cn(
                'truncate',
                active ? 'font-medium text-foreground' : 'hidden text-muted-foreground sm:inline',
              )}
            >
              {label}
            </span>
          </>
        );
        return (
          <li
            key={label}
            className={cn('flex min-w-0 items-center gap-2', active && 'shrink-0')}
            aria-current={active ? 'step' : undefined}
          >
            {i > 0 && <span aria-hidden className="h-px w-4 shrink-0 bg-border sm:w-8" />}
            {done && onStepClick ? (
              <button
                type="button"
                onClick={() => onStepClick(i)}
                className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={`${label} (done) — go back`}
              >
                {inner}
              </button>
            ) : (
              <span className="flex min-w-0 items-center gap-2">
                {inner}
                <span className="sr-only">{done ? ' (done)' : active ? '' : ' (next)'}</span>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export { Steps };
