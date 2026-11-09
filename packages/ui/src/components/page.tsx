import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Page anatomy used by every app screen: a header (title, description,
 * actions) followed by content. Keeps spacing identical across admin, POS
 * and the customer portal.
 */
function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    // Its own bottom space, except inside a grid page (`grid gap-6`), whose gap already
    // spaces it; otherwise the title would get a double gap.
    <div
      className={cn(
        'flex flex-wrap items-end justify-between gap-4 pb-6 [.grid>&]:pb-0',
        className,
      )}
    >
      <div className="grid min-w-0 gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * The top of a single record's page (a contact, order, product, machine):
 * optional back link, avatar/icon, title with badges, a muted meta line and
 * actions. Long titles (emails, names) wrap instead of pushing the page sideways.
 */
function RecordHeader({
  back,
  leading,
  title,
  badges,
  meta,
  actions,
  className,
}: {
  /** A link back to the list, e.g. <Link href="/admin/orders">← Orders</Link>. */
  back?: React.ReactNode;
  leading?: React.ReactNode;
  title: React.ReactNode;
  badges?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="record-header" className={cn('grid gap-3', className)}>
      {back && (
        <div className="text-sm text-muted-foreground [&_a]:transition-colors [&_a:hover]:text-foreground">
          {back}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {leading && <div className="shrink-0">{leading}</div>}
        <div className="grid min-w-0 flex-1 basis-56 gap-1">
          <h1 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xl font-semibold tracking-tight sm:text-2xl">
            <span className="min-w-0 [overflow-wrap:anywhere]">{title}</span>
            {badges}
          </h1>
          {meta && (
            <div className="text-sm [overflow-wrap:anywhere] text-muted-foreground">{meta}</div>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('animate-pulse rounded-md bg-fill', className)} {...props} />;
}

export { PageHeader, RecordHeader, Skeleton };
