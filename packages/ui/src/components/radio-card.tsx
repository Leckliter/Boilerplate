import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Pick one of a few options shown as cards (delivery method, rental plan) — Kumo's (MIT)
 * `Radio` card look. Real radio inputs, so plain forms, `required` and keyboard arrows just
 * work. For a Base UI radio group with Kumo's own API see `Radio`.
 *
 *   <RadioCardGroup legend="Getting it to you">
 *     <RadioCard name="how" value="pickup" label="Pickup" detail="Free" />
 *   </RadioCardGroup>
 */
function RadioCardGroup({
  legend,
  hideLegend = false,
  className,
  children,
  ...props
}: React.ComponentProps<'fieldset'> & { legend: React.ReactNode; hideLegend?: boolean }) {
  return (
    <fieldset data-slot="radio-card-group" className={cn('grid gap-2', className)} {...props}>
      <legend className={cn('mb-2 text-base font-medium text-foreground', hideLegend && 'sr-only')}>
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

function RadioCard({
  label,
  hint,
  detail,
  className,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type'> & {
  label: React.ReactNode;
  /** Smaller muted text under the label. */
  hint?: React.ReactNode;
  /** Right-aligned, e.g. the price. */
  detail?: React.ReactNode;
}) {
  return (
    <label
      data-slot="radio-card"
      className={cn(
        'group/radio flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-hairline bg-card p-3 text-base transition-colors',
        'hover:not-has-checked:not-has-disabled:bg-elevated',
        'has-checked:border-interact has-checked:bg-tint',
        'has-focus-visible:ring-[1.5px] has-focus-visible:ring-ring',
        'has-disabled:cursor-not-allowed has-disabled:opacity-50',
        className,
      )}
    >
      <span className="flex min-w-0 items-start gap-2.5">
        <span className="relative mt-0.5 inline-flex size-4 shrink-0">
          <input
            type="radio"
            className="peer absolute inset-0 z-1 m-0 size-full cursor-pointer appearance-none rounded-full outline-none disabled:cursor-not-allowed"
            {...props}
          />
          <span
            aria-hidden
            className="pointer-events-none flex size-full items-center justify-center rounded-full bg-card ring ring-border transition-colors peer-checked:bg-contrast peer-checked:ring-contrast peer-focus-visible:ring-2 peer-focus-visible:ring-ring [&>span]:hidden peer-checked:[&>span]:block"
          >
            <span className="size-2 rounded-full bg-card" />
          </span>
        </span>
        <span className="grid min-w-0 gap-0.5">
          <span className="font-medium text-foreground">{label}</span>
          {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
        </span>
      </span>
      {detail !== undefined && <span className="shrink-0 tabular-nums">{detail}</span>}
    </label>
  );
}

export { RadioCard, RadioCardGroup };
