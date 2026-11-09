'use client';

import type * as React from 'react';

import { cn } from '../lib/utils';
import { useDates } from './ui-context';

/**
 * A vertical timeline for activity and history ("Order placed", "Paid", "Shipped"). Newest first
 * or oldest first is the caller's order. Times are formatted in the app time zone.
 *
 *   <Timeline items={[{ id: '1', title: 'Order placed', at: order.createdAt }]} />
 */
type TimelineTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

type TimelineItem = {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  at?: Date | string | number;
  /** A small icon inside the marker (decorative). */
  icon?: React.ReactNode;
  tone?: TimelineTone;
  /** Who/what did it: "Sam", "System". */
  actor?: React.ReactNode;
};

const MARKER: Record<TimelineTone, string> = {
  neutral: 'bg-fill text-muted-foreground ring-border',
  brand: 'bg-primary text-primary-foreground ring-primary',
  success: 'bg-success-tint text-success ring-success',
  warning: 'bg-warning-tint text-warning ring-warning',
  danger: 'bg-destructive-tint text-destructive ring-destructive',
};

function Timeline({
  items,
  className,
  ...props
}: Omit<React.ComponentProps<'ol'>, 'children'> & { items: TimelineItem[] }) {
  const { formatWhen } = useDates();
  return (
    <ol data-slot="timeline" className={cn('min-w-0', className)} {...props}>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        const date = item.at != null ? new Date(item.at) : null;
        return (
          <li key={item.id} className="relative flex gap-3 pb-6 last:pb-0">
            {!last && (
              <span
                aria-hidden
                className="absolute top-6 bottom-0 left-3 w-px -translate-x-1/2 bg-border"
              />
            )}
            <span
              aria-hidden
              className={cn(
                'relative flex size-6 shrink-0 items-center justify-center rounded-full ring-1 [&>svg]:size-3.5',
                MARKER[item.tone ?? 'neutral'],
              )}
            >
              {item.icon ?? <span className="size-1.5 rounded-full bg-current" />}
            </span>
            <div className="grid min-w-0 flex-1 gap-0.5 pt-0.5">
              <p className="text-sm font-medium break-words text-foreground">{item.title}</p>
              {item.description && (
                <p className="text-sm break-words text-muted-foreground">{item.description}</p>
              )}
              {(date || item.actor) && (
                <p className="text-xs text-muted-foreground">
                  {item.actor}
                  {item.actor && date ? ' · ' : ''}
                  {date && <time dateTime={date.toISOString()}>{formatWhen(date)}</time>}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export type { TimelineItem, TimelineTone };
export { Timeline };
