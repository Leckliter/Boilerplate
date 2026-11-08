import type * as React from 'react';

import { cn } from '../lib/utils';
import { TableCheckCell, TableCheckHead } from './table-check-cell';

/**
 * Table (Kumo look): semantic HTML, striped rows, sticky header and columns.
 * Server-safe (no hooks). Shadcn names (`TableRow` …) and Kumo's (`Table.Row` …) both work.
 */

const ROW_VARIANTS = {
  default:
    'even:bg-elevated [--rskc-table-row-bg:var(--color-card)] even:[--rskc-table-row-bg:var(--color-elevated)]',
  selected: 'bg-tint [--rskc-table-row-bg:var(--color-tint)]',
} as const;

export type TableRowVariant = keyof typeof ROW_VARIANTS;
export type TableLayout = 'auto' | 'fixed';
export type TableStickyColumn = 'left' | 'right';

/**
 * Sticky-column styles shared by th and td: opaque background, a fade on the inner
 * edge, and z-0/z-1/z-2 inside the table's `isolate` stacking context.
 */
function stickyColumnClasses(side: TableStickyColumn, element: 'head' | 'cell') {
  const base = side === 'right' ? 'sticky right-0' : 'sticky left-0';
  const z = element === 'head' ? 'z-2' : 'z-1';
  const fadePosition = side === 'right' ? 'before:-left-6' : 'before:-right-6';
  const fadeBase = 'before:pointer-events-none before:absolute before:inset-y-0 before:w-6';
  const dir = side === 'right' ? 'before:bg-gradient-to-r' : 'before:bg-gradient-to-l';

  if (element === 'cell') {
    return cn(
      base,
      z,
      'bg-(--rskc-table-row-bg)',
      fadeBase,
      fadePosition,
      dir,
      'before:from-transparent before:to-(--rskc-table-row-bg)',
    );
  }
  return cn(
    base,
    z,
    'bg-card group-data-[compact]/header:bg-elevated',
    fadeBase,
    fadePosition,
    dir,
    'before:from-transparent before:to-card group-data-[compact]/header:before:to-elevated',
  );
}

function Table({
  className,
  layout = 'auto',
  ...props
}: React.ComponentProps<'table'> & {
  /** `auto`: columns size to their content. `fixed`: equal widths, set with `<colgroup>`. */
  layout?: TableLayout;
}) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn(
          'isolate w-full', // creates a stacking context so z-0/z-1/z-2 never leak out
          layout === 'fixed' && 'table-fixed',
          '[&_td]:p-3',
          '[&_th]:border-b [&_th]:border-fill [&_th]:bg-card [&_th]:p-3 [&_th]:text-base [&_th]:font-semibold',
          'text-left text-base text-foreground',
          className,
        )}
        {...props}
      />
    </div>
  );
}

function TableHeader({
  className,
  variant = 'default',
  sticky,
  ...props
}: React.ComponentProps<'thead'> & {
  variant?: 'default' | 'compact';
  /** Stick the header row to the top of a scroll container with a fixed height. */
  sticky?: boolean;
}) {
  const compact = variant === 'compact';
  return (
    <thead
      data-slot="table-header"
      className={cn(
        'group/header',
        compact && 'text-xs text-foreground [&_th]:bg-elevated [&_th]:py-2',
        sticky && '[&_th]:sticky [&_th]:top-0 [&_th]:z-1',
        className,
      )}
      {...(compact && { 'data-compact': '' })}
      {...props}
    />
  );
}

function TableBody({ ...props }: React.ComponentProps<'tbody'>) {
  return <tbody data-slot="table-body" {...props} />;
}

function TableFooter(props: React.ComponentProps<'tfoot'>) {
  return <tfoot data-slot="table-footer" {...props} />;
}

function TableRow({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'tr'> & { variant?: TableRowVariant }) {
  return <tr data-slot="table-row" className={cn(ROW_VARIANTS[variant], className)} {...props} />;
}

function TableHead({
  className,
  sticky,
  ...props
}: React.ComponentProps<'th'> & {
  /** Pin this header cell to the left or right edge of the scroll container. */
  sticky?: TableStickyColumn;
}) {
  return (
    <th
      data-slot="table-head"
      className={cn('group relative', sticky && stickyColumnClasses(sticky, 'head'), className)}
      {...props}
    />
  );
}

function TableCell({
  className,
  sticky,
  ...props
}: React.ComponentProps<'td'> & {
  /** Pin this cell to the left or right edge of the scroll container. */
  sticky?: TableStickyColumn;
}) {
  return (
    <td
      data-slot="table-cell"
      className={cn(sticky && stickyColumnClasses(sticky, 'cell'), className)}
      {...props}
    />
  );
}

/** A drag handle on the edge of a header cell (behaviour is up to you). */
function TableResizeHandle({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      aria-label="Resize column"
      className={cn(
        'invisible h-full group-hover:visible',
        'w-[10px]',
        'flex items-center justify-center',
        'cursor-col-resize touch-none select-none',
        'absolute top-0 right-0',
        'm-0 bg-card p-0',
        'focus-visible:ring-2 focus-visible:ring-primary',
        className,
      )}
      {...props}
    >
      <span className="h-5 w-[2px] rounded bg-hairline" />
    </button>
  );
}

const TableCompound = Object.assign(Table, {
  Header: TableHeader,
  Head: TableHead,
  Row: TableRow,
  Body: TableBody,
  Cell: TableCell,
  CheckCell: TableCheckCell,
  CheckHead: TableCheckHead,
  Footer: TableFooter,
  ResizeHandle: TableResizeHandle,
});

export {
  TableCompound as Table,
  TableBody,
  TableCell,
  TableCheckCell,
  TableCheckHead,
  TableFooter,
  TableHead,
  TableHeader,
  TableResizeHandle,
  TableRow,
};
