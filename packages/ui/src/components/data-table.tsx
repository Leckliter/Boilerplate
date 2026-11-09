'use client';

import * as React from 'react';

import { cn } from '../lib/utils';
import { ActionBar } from './action-bar';
import { CaretDownIcon, CaretUpDownIcon, CaretUpIcon, TrayIcon } from './icons';
import { NativeSelect } from './input';
import { Skeleton } from './page';
import {
  Table,
  TableBody,
  TableCell,
  TableCheckCell,
  TableCheckHead,
  TableHead,
  TableHeader,
  TableRow,
} from './table';

/**
 * DataTable: a list of records with sortable columns, row selection + bulk actions, a sticky
 * header, loading and empty states, and — below `md` — each row turns into a labelled card (no
 * sideways scrolling on a phone). It is a real <table>, so screen readers get headers and
 * `aria-sort`. Sorting is done here unless you pass `sort` + `onSortChange` (server-side sorting).
 *
 *   <DataTable
 *     caption="Orders"
 *     rows={orders}
 *     getRowId={(o) => o.id}
 *     columns={[{ id: 'number', header: 'Order', cell: (o) => o.number, sortValue: (o) => o.number }]}
 *   />
 */
/** Words the table shows; pass translations (all have English defaults). */
interface DataTableLabels {
  /** Label of the phone-width sort menu. @default "Sort by" */
  sortBy?: string;
  /** The unsorted option. @default "Default order" */
  defaultOrder?: string;
  ascending?: (column: string) => string;
  descending?: (column: string) => string;
  selectAll?: (caption: string) => string;
  selectRow?: (id: string) => string;
  /** Screen-reader text of the loading skeleton. @default "Loading" */
  loading?: string;
  /** Shown with no rows (and no `empty` prop). @default "Nothing here yet." */
  empty?: string;
}

const DEFAULT_LABELS: Required<DataTableLabels> = {
  sortBy: 'Sort by',
  defaultOrder: 'Default order',
  ascending: (column) => `${column} (A–Z, low to high)`,
  descending: (column) => `${column} (Z–A, high to low)`,
  selectAll: (caption) => `Select all rows in ${caption}`,
  selectRow: (id) => `Select row ${id}`,
  loading: 'Loading',
  empty: 'Nothing here yet.',
};

type SortDirection = 'asc' | 'desc';
type SortState = { id: string; direction: SortDirection } | null;

type DataTableColumn<T> = {
  id: string;
  header: React.ReactNode;
  /** Plain-text name for the narrow-screen card label and the sort menu. Defaults to `header` when it is a string. */
  label?: string;
  cell: (row: T) => React.ReactNode;
  /** Makes the column sortable by this value. */
  sortValue?: (row: T) => string | number | Date | boolean | null | undefined;
  align?: 'start' | 'end';
  className?: string;
  /** Hide this column's label on a narrow-screen card (for the main "title" column). */
  hideLabelOnCard?: boolean;
};

type DataTableProps<T> = {
  /** What the table is (read by screen readers, and shown on request). */
  caption: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Controlled sort; leave out for uncontrolled. */
  sort?: SortState;
  defaultSort?: SortState;
  /** Called when a header is activated. With this and `sort`, the caller sorts (server-side). */
  onSortChange?: (sort: SortState) => void;
  /** Turn on row checkboxes. */
  selectable?: boolean;
  selectedIds?: string[];
  defaultSelectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  /** Buttons for the bulk ActionBar; gets the selected ids. */
  bulkActions?: (ids: string[]) => React.ReactNode;
  loading?: boolean;
  /** Shown when there are no rows. */
  empty?: React.ReactNode;
  /** Stick the header while the table scrolls inside `maxHeight`. */
  stickyHeader?: boolean;
  /** CSS max-height of the scrolling area, e.g. "24rem". */
  maxHeight?: string;
  labels?: DataTableLabels;
  className?: string;
};

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // empty values always last
  if (b == null) return -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

function DataTable<T>({
  caption,
  columns,
  rows,
  getRowId,
  sort: sortProp,
  defaultSort = null,
  onSortChange,
  selectable,
  selectedIds: selectedProp,
  defaultSelectedIds = [],
  onSelectedIdsChange,
  bulkActions,
  loading,
  empty,
  stickyHeader,
  maxHeight,
  labels: labelsProp,
  className,
}: DataTableProps<T>) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const sortId = React.useId();
  const [innerSort, setInnerSort] = React.useState<SortState>(defaultSort);
  const sort = sortProp !== undefined ? sortProp : innerSort;
  const serverSorted = sortProp !== undefined && onSortChange !== undefined;
  const [innerSel, setInnerSel] = React.useState<string[]>(defaultSelectedIds);
  const selected = selectedProp ?? innerSel;
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);

  const setSort = (next: SortState) => {
    if (sortProp === undefined) setInnerSort(next);
    onSortChange?.(next);
  };
  const setSelected = (ids: string[]) => {
    if (selectedProp === undefined) setInnerSel(ids);
    onSelectedIdsChange?.(ids);
  };

  const sorted = React.useMemo(() => {
    const col = sort && columns.find((c) => c.id === sort.id);
    if (serverSorted || !col?.sortValue || !sort) return rows;
    const get = col.sortValue;
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((x, y) => {
      const a = get(x);
      const b = get(y);
      // Empty values stay last in both directions.
      if (a == null || b == null) return compare(a, b);
      return compare(a, b) * dir;
    });
  }, [rows, columns, sort, serverSorted]);

  // Header cycle: ascending → descending → unsorted.
  const cycle = (id: string) => {
    if (sort?.id !== id) setSort({ id, direction: 'asc' });
    else if (sort.direction === 'asc') setSort({ id, direction: 'desc' });
    else setSort(null);
  };

  const ids = sorted.map(getRowId);
  const allSelected = ids.length > 0 && ids.every((id) => selectedSet.has(id));
  const someSelected = !allSelected && ids.some((id) => selectedSet.has(id));
  const toggleAll = (on: boolean) => setSelected(on ? ids : []);
  const toggleOne = (id: string, on: boolean) =>
    setSelected(on ? [...selected.filter((s) => s !== id), id] : selected.filter((s) => s !== id));

  const sortable = columns.filter((c) => c.sortValue);
  const labelOf = (c: DataTableColumn<T>) =>
    c.label ?? (typeof c.header === 'string' ? c.header : c.id);
  const colCount = columns.length + (selectable ? 1 : 0);

  return (
    <div data-slot="data-table" className={cn('grid min-w-0 gap-3', className)}>
      {sortable.length > 0 && (
        // Header buttons are hidden with the thead on phones, so offer the same sort as a menu.
        <div className="flex items-center gap-2 md:hidden">
          <label htmlFor={sortId} className="shrink-0 text-sm text-muted-foreground">
            {labels.sortBy}
          </label>
          <NativeSelect
            id={sortId}
            size="sm"
            value={sort ? `${sort.id}:${sort.direction}` : ''}
            onChange={(e) => {
              const [id, direction] = e.target.value.split(':');
              setSort(id ? { id, direction: direction as SortDirection } : null);
            }}
          >
            <option value="">{labels.defaultOrder}</option>
            {sortable.flatMap((c) => [
              <option key={`${c.id}:asc`} value={`${c.id}:asc`}>
                {labels.ascending(labelOf(c))}
              </option>,
              <option key={`${c.id}:desc`} value={`${c.id}:desc`}>
                {labels.descending(labelOf(c))}
              </option>,
            ])}
          </NativeSelect>
        </div>
      )}

      <div
        className={cn(
          'min-w-0 rounded-lg bg-card ring ring-border',
          maxHeight ? 'overflow-y-auto' : 'overflow-hidden',
        )}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <Table aria-busy={loading || undefined} className="max-md:block max-md:text-sm">
          <caption className="sr-only">{caption}</caption>
          <TableHeader sticky={stickyHeader} className="max-md:sr-only max-md:block">
            <TableRow variant="default" className="even:bg-transparent">
              {selectable && (
                <TableCheckHead
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={toggleAll}
                  label={labels.selectAll(caption)}
                  disabled={loading || ids.length === 0}
                />
              )}
              {columns.map((c) => {
                const active = sort?.id === c.id;
                const ariaSort = !c.sortValue
                  ? undefined
                  : active
                    ? sort.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none';
                return (
                  <TableHead
                    key={c.id}
                    aria-sort={ariaSort}
                    className={cn(c.align === 'end' && 'text-right', c.className)}
                  >
                    {c.sortValue ? (
                      <button
                        type="button"
                        onClick={() => cycle(c.id)}
                        className={cn(
                          '-mx-1.5 inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold outline-none hover:bg-tint focus-visible:ring-2 focus-visible:ring-ring',
                          c.align === 'end' && 'flex-row-reverse',
                        )}
                      >
                        {c.header}
                        {active ? (
                          sort.direction === 'asc' ? (
                            <CaretUpIcon aria-hidden className="size-3.5" />
                          ) : (
                            <CaretDownIcon aria-hidden className="size-3.5" />
                          )
                        ) : (
                          <CaretUpDownIcon aria-hidden className="size-3.5 text-muted-foreground" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody className="max-md:block">
            {loading &&
              Array.from({ length: 4 }, (_, i) => (
                <TableRow
                  key={`s${i}`}
                  className="max-md:block max-md:border-b max-md:border-hairline max-md:p-3"
                >
                  <TableCell colSpan={colCount} className="max-md:block">
                    <Skeleton className="h-5 w-full" />
                    <span className="sr-only">{labels.loading}</span>
                  </TableCell>
                </TableRow>
              ))}
            {!loading && sorted.length === 0 && (
              <TableRow className="even:bg-transparent max-md:block">
                <TableCell colSpan={colCount} className="max-md:block">
                  {empty ?? (
                    <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                      <TrayIcon aria-hidden className="size-6" />
                      {labels.empty}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              sorted.map((row) => {
                const id = getRowId(row);
                const isSel = selectedSet.has(id);
                return (
                  <TableRow
                    key={id}
                    variant={isSel ? 'selected' : 'default'}
                    data-selected={isSel || undefined}
                    className="max-md:block max-md:border-b max-md:border-hairline max-md:p-3 max-md:last:border-b-0"
                  >
                    {selectable && (
                      <TableCheckCell
                        checked={isSel}
                        onCheckedChange={(on) => toggleOne(id, on)}
                        label={labels.selectRow(id)}
                        className="max-md:block max-md:p-0 max-md:pb-2"
                      />
                    )}
                    {columns.map((c) => (
                      <TableCell
                        key={c.id}
                        data-label={labelOf(c)}
                        className={cn(
                          'max-md:flex max-md:items-baseline max-md:justify-between max-md:gap-4 max-md:px-0 max-md:py-1',
                          !c.hideLabelOnCard &&
                            'max-md:before:shrink-0 max-md:before:text-xs max-md:before:text-muted-foreground max-md:before:content-[attr(data-label)]',
                          c.hideLabelOnCard && 'max-md:font-medium',
                          c.align === 'end' && 'text-right max-md:text-right',
                          c.className,
                        )}
                      >
                        <span className="min-w-0 break-words max-md:text-right">{c.cell(row)}</span>
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      {selectable && (
        <ActionBar
          count={selected.filter((s) => ids.includes(s)).length}
          onClear={() => setSelected([])}
          className="sticky bottom-3 z-10"
        >
          {bulkActions?.(selected)}
        </ActionBar>
      )}
    </div>
  );
}

export type { DataTableColumn, DataTableLabels, DataTableProps, SortDirection, SortState };
export { DataTable };
