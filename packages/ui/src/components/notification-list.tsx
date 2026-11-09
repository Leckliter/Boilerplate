'use client';

import type * as React from 'react';

import { cn } from '../lib/utils';
import { useDates } from './ui-context';
import { Button } from './button';
import { BellIcon, CheckIcon } from './icons';

/**
 * A list of notifications (the inbox in a bell popover or a /account page). Presentational:
 * items in, `onMarkRead` / `onMarkAllRead` out. Unread items have a dot AND the words "Unread"
 * for screen readers.
 */
type NotificationItem = {
  id: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  /** When it happened (formatted in the app time zone). */
  at?: Date | string | number;
  read: boolean;
  href?: string;
  icon?: React.ReactNode;
};

function NotificationList({
  items,
  onMarkRead,
  onMarkAllRead,
  emptyText = 'You are all caught up.',
  className,
}: {
  items: NotificationItem[];
  onMarkRead?: (id: string) => void;
  onMarkAllRead?: () => void;
  emptyText?: string;
  className?: string;
}) {
  const { formatWhen } = useDates();
  const unread = items.filter((i) => !i.read).length;
  return (
    <section
      data-slot="notification-list"
      aria-label="Notifications"
      className={cn('min-w-0', className)}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {unread ? `${unread} unread` : 'No unread'}
        </p>
        {onMarkAllRead && (
          <Button size="sm" variant="ghost" onClick={onMarkAllRead} disabled={!unread}>
            <CheckIcon /> Mark all read
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
          <BellIcon aria-hidden className="size-6" />
          {emptyText}
        </p>
      ) : (
        <ul className="divide-y divide-hairline">
          {items.map((n) => {
            const content = (
              <>
                <span
                  aria-hidden
                  className={cn(
                    'mt-1.5 size-2 shrink-0 rounded-full',
                    n.read ? 'bg-transparent' : 'bg-primary',
                  )}
                />
                {n.icon && (
                  <span
                    aria-hidden
                    className="mt-0.5 shrink-0 text-muted-foreground [&>svg]:size-5"
                  >
                    {n.icon}
                  </span>
                )}
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span
                    className={cn(
                      'text-sm break-words',
                      n.read ? 'text-foreground' : 'font-medium text-foreground',
                    )}
                  >
                    {!n.read && <span className="sr-only">Unread: </span>}
                    {n.title}
                  </span>
                  {n.body && (
                    <span className="text-sm break-words text-muted-foreground">{n.body}</span>
                  )}
                  {n.at != null && (
                    <span className="text-xs text-muted-foreground">{formatWhen(n.at)}</span>
                  )}
                </span>
              </>
            );
            return (
              <li
                key={n.id}
                className={cn('flex items-start gap-1 px-4 py-3', !n.read && 'bg-tint')}
              >
                {n.href ? (
                  <a
                    href={n.href}
                    className="flex min-w-0 flex-1 items-start gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {content}
                  </a>
                ) : (
                  <div className="flex min-w-0 flex-1 items-start gap-3">{content}</div>
                )}
                {!n.read && onMarkRead && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Mark as read"
                    onClick={() => onMarkRead(n.id)}
                  >
                    <CheckIcon />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export type { NotificationItem };
export { NotificationList };
