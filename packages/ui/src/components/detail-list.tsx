import type * as React from 'react';

import { cn } from '../lib/utils';
import { CopyButton } from './copy-button';
import { linkVariants } from './link';

/**
 * Read-only label/value pairs — how a record's details look when you're not
 * editing them. Stacks on phones, two columns (label | value) from `sm` up.
 */
function DetailList({ className, ...props }: React.ComponentProps<'dl'>) {
  return (
    <dl
      data-slot="detail-list"
      className={cn(
        'grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[minmax(7rem,auto)_1fr] sm:gap-y-2.5',
        className,
      )}
      {...props}
    />
  );
}

/**
 * One row of a DetailList. Empty values (null, undefined, '') show a quiet
 * "Not set". Pass `copy` to add a copy button (emails, phone numbers, serials).
 */
function DetailItem({
  label,
  children,
  copy,
  className,
}: {
  label: React.ReactNode;
  children?: React.ReactNode;
  copy?: string | null;
  className?: string;
}) {
  const empty = children === null || children === undefined || children === '';
  return (
    <div data-slot="detail-item" className={cn('grid gap-0.5 sm:contents', className)}>
      <dt className="text-muted-foreground sm:py-0.5">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1 sm:py-0.5">
        {empty ? (
          <span className="text-muted-foreground">Not set</span>
        ) : (
          <span className="min-w-0 [overflow-wrap:anywhere] whitespace-pre-line">{children}</span>
        )}
        {copy && !empty && (
          <span className="-my-1 shrink-0">
            <CopyButton value={copy} size="xs" variant="ghost">
              <span className="sr-only">Copy</span>
            </CopyButton>
          </span>
        )}
      </dd>
    </div>
  );
}

/** A value that's a link (mailto:, tel:, another record). */
function DetailLink({ className, ...props }: React.ComponentProps<'a'>) {
  return <a className={cn(linkVariants(), className)} {...props} />;
}

export { DetailItem, DetailLink, DetailList };
