'use client';

import type * as React from 'react';

import { cn } from '../lib/utils';
import { Button } from './button';

/**
 * The bar that appears when rows are selected: "3 selected" + the bulk actions + Clear. It is a
 * labelled region and announces the count politely. DataTable renders it for you; use it directly
 * for any selection UI (a card grid, a gallery).
 */
function ActionBar({
  count,
  onClear,
  children,
  noun = 'selected',
  className,
}: {
  count: number;
  onClear?: () => void;
  /** The bulk action buttons. */
  children?: React.ReactNode;
  noun?: string;
  className?: string;
}) {
  return (
    <div role="region" aria-label="Bulk actions" data-slot="action-bar" className={className}>
      <div aria-live="polite" className="sr-only">
        {count > 0 ? `${count} ${noun}` : ''}
      </div>
      {count > 0 && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm text-card-foreground shadow-lg ring ring-border',
          )}
        >
          <span className="mr-auto font-medium tabular-nums">
            {count} {noun}
          </span>
          {children}
          {onClear && (
            <Button size="sm" variant="ghost" onClick={onClear}>
              Clear
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export { ActionBar };
