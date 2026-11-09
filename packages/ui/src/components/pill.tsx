import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Pill: a small status label with an optional dot (an order is "Paid", a job is "Late").
 * StatusDot: just the dot, with its meaning in words for screen readers.
 * For counts and tags use Badge; use Pill when the colour carries a state.
 */
const TONES = {
  neutral: { pill: 'bg-fill text-badge-neutral-subtle', dot: 'bg-badge-neutral' },
  brand: {
    pill: 'bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100',
    dot: 'bg-primary',
  },
  success: { pill: 'bg-success-tint text-success', dot: 'bg-success' },
  warning: { pill: 'bg-warning-tint text-warning', dot: 'bg-warning' },
  danger: { pill: 'bg-destructive-tint text-destructive', dot: 'bg-destructive' },
  info: { pill: 'bg-info-tint text-info', dot: 'bg-info' },
} as const;

type PillTone = keyof typeof TONES;

const pillVariants = cva('inline-flex max-w-full items-center gap-1.5 rounded-full font-medium', {
  variants: {
    size: { sm: 'h-5 px-2 text-xs', base: 'h-6 px-2.5 text-sm' },
  },
  defaultVariants: { size: 'base' },
});

function Pill({
  tone = 'neutral',
  dot = false,
  size,
  className,
  children,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof pillVariants> & { tone?: PillTone; dot?: boolean }) {
  return (
    <span
      data-slot="pill"
      className={cn(pillVariants({ size }), TONES[tone].pill, className)}
      {...props}
    >
      {dot && (
        <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', TONES[tone].dot)} />
      )}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

function StatusDot({
  tone = 'neutral',
  label,
  pulse = false,
  className,
  ...props
}: Omit<React.ComponentProps<'span'>, 'children'> & {
  tone?: PillTone;
  /** What the dot means ("Online"). Read by screen readers; the dot is never colour-only. */
  label: string;
  /** A soft ping for live states. Off for people who prefer reduced motion. */
  pulse?: boolean;
}) {
  return (
    <span
      data-slot="status-dot"
      role="img"
      aria-label={label}
      className={cn('relative inline-flex size-2.5 shrink-0', className)}
      {...props}
    >
      {pulse && (
        <span
          aria-hidden
          className={cn(
            'absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping',
            TONES[tone].dot,
          )}
        />
      )}
      <span aria-hidden className={cn('relative size-full rounded-full', TONES[tone].dot)} />
    </span>
  );
}

export type { PillTone };
export { Pill, pillVariants, StatusDot };
