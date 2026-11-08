import { cva } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { focusRing } from './link';

/**
 * A row of filters above a list (All · Paid · Out · Late). They're links, so
 * the filter lives in the URL. Use with Next's <Link>:
 *
 *   <FilterTabs label="Status">
 *     <Link href="?status=paid" className={filterTabVariants({ active })}
 *       aria-current={active ? 'page' : undefined}>Paid <FilterTabCount>3</FilterTabCount></Link>
 *   </FilterTabs>
 */
function FilterTabs({
  label,
  className,
  ...props
}: React.ComponentProps<'nav'> & { label: string }) {
  return (
    <nav
      data-slot="filter-tabs"
      aria-label={label}
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      {...props}
    />
  );
}

const filterTabVariants = cva(
  `inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium whitespace-nowrap transition-colors ${focusRing}`,
  {
    variants: {
      active: {
        true: 'border-foreground bg-foreground text-background',
        false: 'border-border bg-card text-foreground hover:bg-accent dark:bg-secondary',
      },
    },
    defaultVariants: { active: false },
  },
);

/** A small count inside a filter tab. */
function FilterTabCount({ className, ...props }: React.ComponentProps<'span'>) {
  return <span className={cn('text-xs tabular-nums opacity-70', className)} {...props} />;
}

export { FilterTabCount, FilterTabs, filterTabVariants };
