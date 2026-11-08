import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Label … amount rows: order totals, receipts, what a machine has cost.
 * Amounts line up on the right in tabular figures.
 */
function SummaryList({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="summary-list" className={cn('grid gap-1 text-sm', className)} {...props} />
  );
}

/**
 * One row. `total` makes it the bottom line (a rule above, bold); `sub` makes it
 * an indented, muted add-on to the row above (e.g. "+ Hoses — Included").
 */
function SummaryRow({
  label,
  value,
  total,
  sub,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  total?: boolean;
  sub?: boolean;
  className?: string;
}) {
  return (
    <div
      data-slot="summary-row"
      className={cn(
        'flex justify-between gap-3',
        sub && 'pl-4 text-muted-foreground',
        total && 'mt-1 border-t border-hairline pt-2 font-semibold',
        className,
      )}
    >
      <span className="min-w-0">{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

export { SummaryList, SummaryRow };
