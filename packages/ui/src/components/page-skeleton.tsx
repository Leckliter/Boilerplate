import { cn } from '../lib/utils';
import { Card } from './card';
import { Skeleton } from './page';
import { SkeletonLine } from './skeleton-line';

/**
 * Loading states shaped like the real page, for `loading.tsx` files and Suspense
 * fallbacks. Server-safe. Announces itself politely to screen readers.
 *
 *   export default function Loading() { return <PageLoading variant="list" />; }
 */

function Header({ withActions }: { withActions?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div className="grid min-w-0 gap-2">
        <Skeleton className="h-7 w-48 max-w-full" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {withActions && <Skeleton className="h-9 w-28" />}
    </div>
  );
}

export type PageLoadingProps = {
  /** `list`: header + toolbar + table rows. `record`: header + a few detail cards. */
  variant?: 'list' | 'record';
  /** Table rows (list) or cards (record). */
  rows?: number;
  className?: string;
};

function PageLoading({ variant = 'list', rows, className }: PageLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-slot="page-loading"
      className={cn('min-w-0', className)}
    >
      <span className="sr-only">Loading…</span>
      <Header withActions />
      {variant === 'list' ? <ListBody rows={rows ?? 6} /> : <RecordBody cards={rows ?? 2} />}
    </div>
  );
}

function ListBody({ rows }: { rows: number }) {
  return (
    <div className="grid gap-4" aria-hidden>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-9 w-24" />
      </div>
      <Card className="gap-0 overflow-hidden p-0">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-hairline p-3 last:border-b-0">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="grid min-w-0 flex-1 gap-1.5">
              <SkeletonLine minWidth={30} maxWidth={60} />
              <SkeletonLine minWidth={20} maxWidth={40} />
            </div>
            <Skeleton className="hidden h-5 w-16 sm:block" />
          </div>
        ))}
      </Card>
    </div>
  );
}

function RecordBody({ cards }: { cards: number }) {
  return (
    <div className="grid gap-6" aria-hidden>
      {Array.from({ length: cards }, (_, i) => (
        <Card key={i} className="grid gap-3 p-5">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 3 }, (_, j) => (
            <div key={j} className="grid gap-1.5 sm:grid-cols-[10rem_1fr]">
              <Skeleton className="h-4 w-24" />
              <SkeletonLine minWidth={30} maxWidth={70} />
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}

export { PageLoading };
