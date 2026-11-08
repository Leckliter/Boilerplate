'use client';

import * as React from 'react';

import { cn } from '../lib/utils';
import { MagnifyingGlassIcon } from './icons';
import { Input } from './input';

/**
 * The row above a list or table: a search box on the left, filters next to it, actions on
 * the right. Wraps on a phone. The search box is controlled by the caller (state or URL).
 *
 *   <ListToolbar search={q} onSearchChange={setQ} filters={<FilterTabs … />} actions={<Button>Export</Button>} />
 */
export type ListToolbarProps = {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Accessible name of the search box. */
  searchLabel?: string;
  /** Filters / sort controls shown after the search box. */
  filters?: React.ReactNode;
  /** Buttons on the right. */
  actions?: React.ReactNode;
  className?: string;
};

function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search',
  searchLabel = 'Search',
  filters,
  actions,
  className,
}: ListToolbarProps) {
  return (
    <div
      role="search"
      data-slot="list-toolbar"
      className={cn('flex flex-wrap items-center gap-2 pb-4', className)}
    >
      {onSearchChange && (
        <div className="relative min-w-0 flex-1 basis-56 sm:max-w-sm">
          <MagnifyingGlassIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
            className="pl-9"
          />
        </div>
      )}
      {filters && <div className="flex min-w-0 flex-wrap items-center gap-2">{filters}</div>}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export { ListToolbar };
