'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import type * as React from 'react';
import { CaretDoubleLeftIcon, CaretDoubleRightIcon, CaretLeftIcon, CaretRightIcon } from './icons';
import { cn } from '../lib/utils';
import { Button } from './button';

const DEFAULT_PAGE_SIZE_OPTIONS = [25, 50, 100, 250] as const;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// ============================================================================
// i18n Labels
// ============================================================================

/**
 * Labels for internationalization of Pagination component.
 * All labels have English defaults and can be overridden for other locales.
 *
 * Note: To customize the "Showing X-Y of Z" text, use the `children` render prop
 * on `Pagination.Info` instead. To customize the "Per page:" label, use the
 * `label` prop on `Pagination.PageSize`.
 */
export interface PaginationLabels {
  /** Aria label for the navigation landmark. @default "Pagination" */
  navigation?: string;
  /** Aria label for the first page button. @default "First page" */
  firstPage?: string;
  /** Aria label for the previous page button. @default "Previous page" */
  previousPage?: string;
  /** Aria label for the next page button. @default "Next page" */
  nextPage?: string;
  /** Aria label for the last page button. @default "Last page" */
  lastPage?: string;
  /** Aria label for the page number input/select. @default "Page number" */
  pageNumber?: string;
  /** Aria label for the page size select. @default "Page size" */
  pageSize?: string;
}

const DEFAULT_LABELS: Required<PaginationLabels> = {
  navigation: 'Pagination',
  firstPage: 'First page',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  lastPage: 'Last page',
  pageNumber: 'Page number',
  pageSize: 'Page size',
};

export type PaginationControlsMode = 'full' | 'simple';

export interface PaginationVariantsProps {
  /** `full`: first / previous / page number / next / last. `simple`: previous and next only. */
  controls?: PaginationControlsMode;
}

/** A native select that looks like a Select (the page-size and page-number pickers). */
function PagerSelect({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'select'>, 'value' | 'onChange'> & {
  value: number;
  onValueChange: (value: number) => void;
}) {
  const { onValueChange, ...rest } = props;
  return (
    <select
      {...rest}
      onChange={(e) => onValueChange(Number(e.target.value))}
      className={cn(
        'h-9 rounded-lg bg-card px-2.5 text-base text-foreground shadow-xs ring ring-border outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {children}
    </select>
  );
}

/** Buttons and the page input joined into one control (InputGroup look). */
function PagerGroup({ children }: { children: ReactNode }) {
  return (
    <div
      role="group"
      className="relative isolate inline-flex w-max flex-row [&>*]:relative [&>*:focus-visible]:z-10 [&>*:not(:first-child)]:-ms-px [&>*:not(:first-child)]:rounded-s-none [&>*:not(:last-child)]:rounded-e-none [&>button]:shadow-none"
    >
      {children}
    </div>
  );
}

function PagerButton(props: Omit<React.ComponentProps<typeof Button>, 'variant' | 'shape'>) {
  return <Button variant="secondary" shape="square" {...props} />;
}

// ============================================================================
// Pagination Context
// ============================================================================

interface PaginationContextValue {
  page: number;
  perPage?: number;
  totalCount?: number;
  hasNextPage?: boolean;
  maxPage: number;
  pageShowingRange: string;
  setPage: (page: number) => void;
  editingPage: string;
  setEditingPage: (page: string) => void;
  labels: Required<PaginationLabels>;
}

const PaginationContext = createContext<PaginationContextValue | null>(null);

function usePaginationContext() {
  const context = useContext(PaginationContext);
  if (!context) {
    throw new Error('Pagination compound components must be used within a Pagination component');
  }
  return context;
}

// ============================================================================
// Pagination.Info
// ============================================================================

export interface PaginationInfoProps {
  /** Custom render function for the info text */
  children?: (props: {
    page: number;
    perPage?: number;
    totalCount?: number;
    pageShowingRange: string;
  }) => ReactNode;
  /** Additional CSS classes */
  className?: string;
}

function PaginationInfo({ children, className }: PaginationInfoProps) {
  const { page, perPage, totalCount, pageShowingRange } = usePaginationContext();

  const content = children ? (
    children({ page, perPage, totalCount, pageShowingRange })
  ) : totalCount && totalCount > 0 ? (
    <>
      Showing <span className="tabular-nums">{pageShowingRange}</span> of{' '}
      <span className="tabular-nums">{totalCount}</span>
    </>
  ) : null;

  return (
    <div data-slot="pagination-info" className={cn('text-sm text-muted-foreground', className)}>
      {content}
    </div>
  );
}

PaginationInfo.displayName = 'Pagination.Info';

// ============================================================================
// Pagination.PageSize
// ============================================================================

export interface PaginationPageSizeProps {
  /** Current page size value */
  value: number;
  /** Callback when page size changes */
  onChange: (size: number) => void;
  /** Available page size options */
  options?: number[];
  /**
   * Label text shown before the selector.
   * @default "Per page:"
   */
  label?: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

function PaginationPageSize({
  value,
  onChange,
  options = DEFAULT_PAGE_SIZE_OPTIONS as unknown as number[],
  label = 'Per page:',
  className,
}: PaginationPageSizeProps) {
  const { labels } = usePaginationContext();

  return (
    <div data-slot="pagination-page-size" className={cn('flex items-center gap-2', className)}>
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
      <PagerSelect aria-label={labels.pageSize} value={value} onValueChange={onChange}>
        {options.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </PagerSelect>
    </div>
  );
}

PaginationPageSize.displayName = 'Pagination.PageSize';

// ============================================================================
// Pagination.Controls
// ============================================================================

export interface PaginationControlsProps extends PaginationVariantsProps {
  /**
   * How the page number selector is rendered in "full" controls mode.
   * - `"input"` (default): A text input where users type a page number.
   * - `"dropdown"`: A dropdown select with all page numbers as options.
   *
   * **Note:** `"dropdown"` renders an option for every page, so it is best
   * suited for small page counts. For large datasets (hundreds of pages or
   * more) prefer `"input"` to avoid rendering performance overhead.
   */
  pageSelector?: 'input' | 'dropdown';
  /** Additional CSS classes */
  className?: string;
}

function PaginationControls({
  controls = 'full',
  pageSelector = 'input',
  className,
}: PaginationControlsProps) {
  const { page, totalCount, hasNextPage, maxPage, setPage, editingPage, setEditingPage, labels } =
    usePaginationContext();
  const hasKnownTotal = totalCount != null;
  const isUnknownTotal = !hasKnownTotal && hasNextPage !== undefined;
  const showFullControls = controls === 'full' && !isUnknownTotal;
  const isNextDisabled = hasKnownTotal ? page >= maxPage : hasNextPage !== true;

  const commitEditingPage = () => {
    const value = editingPage.trim();
    if (!/^\d+$/.test(value)) {
      setEditingPage(String(page));
      return;
    }
    const clamped = clamp(Number(value), 1, maxPage);
    setPage(clamped);
    setEditingPage(String(clamped));
  };

  return (
    <div data-slot="pagination-controls" className={cn('flex grow flex-col items-end', className)}>
      <nav aria-label={labels.navigation}>
        <PagerGroup>
          {showFullControls && (
            <PagerButton
              aria-label={labels.firstPage}
              disabled={page <= 1}
              onClick={() => {
                setPage(1);
                setEditingPage('1');
              }}
            >
              <CaretDoubleLeftIcon />
            </PagerButton>
          )}
          <PagerButton
            aria-label={labels.previousPage}
            disabled={page <= 1}
            onClick={() => {
              const previousPage = Math.max(page - 1, 1);
              setPage(previousPage);
              setEditingPage(String(previousPage));
            }}
          >
            <CaretLeftIcon />
          </PagerButton>
          {showFullControls &&
            (pageSelector === 'dropdown' ? (
              <PagerSelect
                aria-label={labels.pageNumber}
                className="rounded-none ring-hairline"
                value={page}
                onValueChange={(num) => {
                  setPage(num);
                  setEditingPage(String(num));
                }}
              >
                {Array.from({ length: maxPage }, (_, i) => i + 1).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </PagerSelect>
            ) : (
              <input
                style={{ width: 50 }}
                className="h-9 bg-card text-center text-base text-foreground ring ring-border outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={labels.pageNumber}
                inputMode="numeric"
                value={editingPage}
                onChange={(e) => {
                  setEditingPage(e.target.value);
                }}
                onBlur={commitEditingPage}
                onKeyDown={(e: KeyboardEvent) => {
                  if (e.key === 'Enter') {
                    commitEditingPage();
                  }
                }}
                // Prevent password managers from auto-filling
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
              />
            ))}
          <PagerButton
            aria-label={labels.nextPage}
            disabled={isNextDisabled}
            onClick={() => {
              const nextPage = hasKnownTotal ? Math.min(page + 1, maxPage) : page + 1;
              setPage(nextPage);
              setEditingPage(String(nextPage));
            }}
          >
            <CaretRightIcon />
          </PagerButton>
          {showFullControls && (
            <PagerButton
              aria-label={labels.lastPage}
              disabled={page >= maxPage}
              onClick={() => {
                setPage(maxPage);
                setEditingPage(String(maxPage));
              }}
            >
              <CaretDoubleRightIcon />
            </PagerButton>
          )}
        </PagerGroup>
      </nav>
    </div>
  );
}

PaginationControls.displayName = 'Pagination.Controls';

// ============================================================================
// Pagination.Separator
// ============================================================================

export interface PaginationSeparatorProps {
  /** Additional CSS classes */
  className?: string;
}

function PaginationSeparator({ className }: PaginationSeparatorProps) {
  return (
    <div
      data-slot="pagination-separator"
      className={cn('mx-2 h-6 border-l border-hairline', className)}
    />
  );
}

PaginationSeparator.displayName = 'Pagination.Separator';

// ============================================================================
// Pagination Root
// ============================================================================

/** Base props shared by both compound and legacy Pagination APIs */
interface PaginationBaseProps {
  /** Callback fired when the current page changes. */
  setPage: (page: number) => void;
  /**
   * Current page number (1-indexed).
   * @default 1
   */
  page?: number;
  /** Number of items displayed per page. */
  perPage?: number;
  /** Total number of items across all pages. */
  totalCount?: number;
  /**
   * Whether another page exists when the total count is unknown. Ignored when
   * `totalCount` is provided. Unknown totals use sequential controls only.
   */
  hasNextPage?: boolean;
  /** Additional CSS classes for the container */
  className?: string;
  /**
   * Labels for internationalization of aria-labels. All labels have English defaults.
   *
   * For visible text like "Showing X of Y", use render props on sub-components:
   * - `Pagination.Info` children for the info text
   * - `Pagination.PageSize` label prop for the "Per page:" text
   *
   * @example
   * ```tsx
   * <Pagination
   *   labels={{
   *     firstPage: "Première page",
   *     previousPage: "Page précédente",
   *     nextPage: "Page suivante",
   *     lastPage: "Dernière page",
   *     pageNumber: "Numéro de page",
   *     pageSize: "Taille de page",
   *   }}
   *   // ...
   * />
   * ```
   */
  labels?: PaginationLabels;
}

/**
 * Props for the compound component API (recommended).
 *
 * @example
 * ```tsx
 * <Pagination page={page} setPage={setPage} perPage={perPage} totalCount={500}>
 *   <Pagination.Info />
 *   <Pagination.PageSize value={perPage} onChange={setPerPage} />
 *   <Pagination.Controls />
 * </Pagination>
 * ```
 */
export interface PaginationCompoundProps extends PaginationBaseProps {
  /**
   * Compound component children for custom layouts.
   * Use Pagination.Info, Pagination.PageSize, Pagination.Controls, and Pagination.Separator.
   */
  children: ReactNode;
  controls?: never;
  text?: never;
}

/**
 * Props for the legacy API (deprecated, use compound components instead).
 *
 * @deprecated Use the compound component API with children instead:
 * ```tsx
 * <Pagination page={page} setPage={setPage} perPage={perPage} totalCount={500}>
 *   <Pagination.Info />
 *   <Pagination.Controls />
 * </Pagination>
 * ```
 *
 * @example
 * ```tsx
 * // Legacy usage (deprecated)
 * <Pagination page={page} setPage={setPage} perPage={10} totalCount={100} />
 * ```
 */
export interface PaginationLegacyProps extends PaginationBaseProps, PaginationVariantsProps {
  children?: never;
  /** @deprecated Use Pagination.Info with children prop instead */
  text?: (props: {
    page?: number;
    perPage?: number;
    totalCount?: number;
    pageShowingRange: string;
  }) => ReactNode;
}

/**
 * Pagination component props.
 *
 * Prefer the compound component API for new code:
 * @example
 * ```tsx
 * <Pagination page={page} setPage={setPage} perPage={perPage} totalCount={500}>
 *   <Pagination.Info />
 *   <Pagination.PageSize value={perPage} onChange={setPerPage} />
 *   <Pagination.Controls />
 * </Pagination>
 * ```
 */
export type PaginationProps = PaginationCompoundProps | PaginationLegacyProps;

/**
 * Page navigation controls with page count display.
 *
 * Supports both compound component and legacy patterns. Prefer compound components for new code:
 *
 * @example
 * // Compound component (recommended)
 * ```tsx
 * <Pagination page={page} setPage={setPage} perPage={perPage} totalCount={500}>
 *   <Pagination.Info />
 *   <Pagination.Separator />
 *   <Pagination.PageSize value={perPage} onChange={setPerPage} />
 *   <Pagination.Controls />
 * </Pagination>
 * ```
 *
 * @example
 * // Legacy (deprecated)
 * ```tsx
 * <Pagination page={page} setPage={setPage} perPage={10} totalCount={100} />
 * ```
 */
function PaginationRoot(props: PaginationProps) {
  const {
    page = 1,
    perPage,
    totalCount,
    hasNextPage,
    setPage,
    children,
    className,
    labels: labelsProp,
  } = props;

  // Extract legacy props (only present when children is not provided)
  const text = 'text' in props ? props.text : undefined;
  const controls = 'controls' in props ? (props.controls ?? 'full') : 'full';
  const [editingPage, setEditingPage] = useState<string>(String(page));

  // Merge provided labels with defaults
  const labels = useMemo<Required<PaginationLabels>>(
    () => ({ ...DEFAULT_LABELS, ...labelsProp }),
    [labelsProp],
  );

  useEffect(() => {
    setEditingPage(String(page));
  }, [page]);

  const pageShowingRange = useMemo(() => {
    let lower = page * (perPage ?? 1) - (perPage ?? 0) + 1;
    let upper = Math.min(page * (perPage ?? 0), totalCount ?? 0);

    if (Number.isNaN(lower)) lower = 0;
    if (Number.isNaN(upper)) upper = 0;

    return `${lower}-${upper}`;
  }, [page, perPage, totalCount]);

  const maxPage = useMemo(() => {
    // An empty result set still has a single (empty) page
    return Math.max(Math.ceil((totalCount ?? 1) / (perPage ?? 1)), 1);
  }, [totalCount, perPage]);

  const contextValue: PaginationContextValue = {
    page,
    perPage,
    totalCount,
    hasNextPage,
    maxPage,
    pageShowingRange,
    setPage,
    editingPage,
    setEditingPage,
    labels,
  };

  // Compound component mode: render children within context
  if (children) {
    return (
      <PaginationContext.Provider value={contextValue}>
        <div
          data-slot="pagination"
          className={cn('flex w-full flex-wrap items-center gap-2', className)}
        >
          {children}
        </div>
      </PaginationContext.Provider>
    );
  }

  // Legacy mode: render default layout for backwards compatibility
  const getPaginationText = () => {
    if (text) {
      return text({ page, perPage, totalCount, pageShowingRange });
    } else if (totalCount && totalCount > 0) {
      return (
        <>
          Showing <span className="tabular-nums">{pageShowingRange}</span> of{' '}
          <span className="tabular-nums">{totalCount}</span>
        </>
      );
    }
    return null;
  };

  return (
    <PaginationContext.Provider value={contextValue}>
      <div
        data-slot="pagination"
        className={cn('flex w-full flex-wrap items-center gap-2', className)}
      >
        <div
          aria-live="polite"
          aria-atomic="true"
          data-slot="pagination-info"
          className="grow text-sm text-muted-foreground"
        >
          {getPaginationText()}
        </div>
        <PaginationControls controls={controls} />
      </div>
    </PaginationContext.Provider>
  );
}

PaginationRoot.displayName = 'Pagination';

// ============================================================================
// Compound Component Export
// ============================================================================

export const Pagination = Object.assign(PaginationRoot, {
  Info: PaginationInfo,
  PageSize: PaginationPageSize,
  Controls: PaginationControls,
  Separator: PaginationSeparator,
});

export { PaginationInfo, PaginationPageSize, PaginationControls, PaginationSeparator };
