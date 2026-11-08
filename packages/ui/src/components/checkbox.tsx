import type * as React from 'react';

import { cn } from '../lib/utils';
import { CheckIcon, MinusIcon } from './icons';

/**
 * A checkbox in house style — a 16px box with a hairline ring that fills with
 * the contrast colour when checked. It is still a real <input type="checkbox"> (works in plain
 * forms, `defaultChecked`, `onChange`, keyboard and screen readers); `className` styles the box.
 * `variant="error"` rings it red. Pair it with a label — `<CheckboxField>` does that.
 */
function Checkbox({
  className,
  variant = 'default',
  ...props
}: Omit<React.ComponentProps<'input'>, 'type'> & { variant?: 'default' | 'error' }) {
  return (
    <span
      data-slot="checkbox"
      className={cn(
        'group/checkbox relative inline-flex size-4 shrink-0 align-middle',
        'has-disabled:cursor-not-allowed has-disabled:opacity-50',
        className,
      )}
    >
      <input
        type="checkbox"
        aria-invalid={variant === 'error' ? true : undefined}
        className="peer absolute inset-0 z-1 m-0 size-full cursor-pointer appearance-none rounded-sm outline-none disabled:cursor-not-allowed"
        {...props}
      />
      <span
        aria-hidden
        className={cn(
          'pointer-events-none flex size-full items-center justify-center rounded-sm bg-card text-inverse ring transition-colors',
          variant === 'error' ? 'ring-destructive' : 'ring-hairline',
          'peer-hover:ring-interact peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
          'peer-checked:bg-contrast peer-checked:ring-contrast peer-indeterminate:bg-contrast peer-indeterminate:ring-contrast',
          'peer-aria-invalid:ring-destructive',
          '[&>svg]:hidden peer-checked:[&>svg.check]:block peer-indeterminate:[&>svg.check]:hidden peer-indeterminate:[&>svg.minus]:block',
        )}
      >
        <CheckIcon weight="bold" className="check size-3" />
        <MinusIcon weight="bold" className="minus size-3" />
      </span>
    </span>
  );
}

function CheckboxField({
  label,
  hint,
  className,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type'> & {
  label: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2 text-base has-disabled:cursor-not-allowed',
        className,
      )}
    >
      <Checkbox className="mt-1" {...props} />
      <span className="grid min-w-0 gap-0.5">
        <span className="text-foreground">{label}</span>
        {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

export { Checkbox, CheckboxField };
