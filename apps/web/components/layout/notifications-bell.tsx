'use client';

import { BellIcon, BellRingingIcon } from '@app/ui/components/icons';
import { type NotificationItem, NotificationList } from '@app/ui/components/notification-list';
import { Popover } from '@app/ui/components/popover';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { invokeAction } from '@/lib/invoke';

type Recent = {
  items: {
    id: string;
    title: string;
    body: string | null;
    href: string | null;
    urgent: boolean;
    createdAt: string | Date;
    readAt: string | Date | null;
  }[];
  unread: number;
  attention: number;
};

/** How often the unread count is refreshed while the tab is visible. */
const POLL_MS = 60_000;

/**
 * The bell in the header: the real unread count and a popover with the latest notifications
 * (`notifications.recent`; `markRead` / `markAllRead` from the list; "See all" → /account/notifications).
 * Refreshes on an interval and when the tab regains focus, and pauses while the tab is hidden, so a
 * background tab costs nothing. A failing refresh just keeps the last numbers (it is only a badge).
 */
export function NotificationsBell() {
  const t = useTranslations('bell');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Recent | null>(null);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current || document.visibilityState === 'hidden') return;
    busy.current = true;
    try {
      const res = await invokeAction('notifications.recent', { limit: 8 });
      if (res.ok) {
        setData(res.data as Recent);
        setFailed(false);
      } else {
        setFailed(true);
      }
    } catch {
      // Expected: offline, or a deploy happened since this tab loaded. Keep the last numbers; try again later.
      setFailed(true);
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    const wake = () => void refresh();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
    };
  }, [refresh]);

  const unread = data?.unread ?? 0;
  const items: NotificationItem[] = (data?.items ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body ?? undefined,
    at: n.createdAt,
    read: n.readAt !== null,
    href: n.href ?? undefined,
  }));

  async function markRead(id: string) {
    setData(
      (d) =>
        d && {
          ...d,
          unread: Math.max(0, d.unread - 1),
          items: d.items.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n)),
        },
    );
    await invokeAction('notifications.markRead', { ids: [id] });
    void refresh();
  }

  async function markAll() {
    setData(
      (d) =>
        d && {
          ...d,
          unread: 0,
          items: d.items.map((n) => ({ ...n, readAt: n.readAt ?? new Date() })),
        },
    );
    await invokeAction('notifications.markAllRead', {});
    void refresh();
  }

  /** A click on an item: mark it read, then go there (a plain link would leave it unread). */
  async function openItem(e: React.MouseEvent) {
    const link = (e.target as HTMLElement).closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    const item = data?.items.find((n) => n.href === href);
    if (!item || !href) return;
    e.preventDefault();
    setOpen(false);
    if (!item.readAt) await markRead(item.id);
    router.push(href);
  }

  const label = unread > 0 ? t('labelUnread', { count: unread }) : t('label');
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={label}
        title={t('label')}
        className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-tint hover:text-foreground focus-visible:ring-[1.5px] focus-visible:ring-ring"
      >
        {unread > 0 ? <BellRingingIcon className="size-5" /> : <BellIcon className="size-5" />}
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-destructive-foreground tabular-nums"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Content align="end" sideOffset={6} className="w-[min(24rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-3">
          <Popover.Title>{t('title')}</Popover.Title>
          <Link
            href="/account/notifications"
            onClick={() => setOpen(false)}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            {t('viewAll')}
          </Link>
        </div>
        <div
          role="presentation"
          onClick={openItem}
          className="max-h-[min(24rem,60vh)] overflow-y-auto"
        >
          {failed && !data ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t('error')}</p>
          ) : (
            <NotificationList
              items={items}
              onMarkRead={markRead}
              onMarkAllRead={markAll}
              emptyText={t('empty')}
            />
          )}
        </div>
      </Popover.Content>
    </Popover>
  );
}
