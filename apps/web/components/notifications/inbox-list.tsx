'use client';

import { Badge } from '@app/ui/components/badge';
import { Button } from '@app/ui/components/button';
import { CheckIcon, XIcon } from '@app/ui/components/icons';
import { formatDateTime } from '@app/ui/lib/dates';
import { cn } from '@app/ui/lib/utils';
import { useRouter } from 'next/navigation';

import { useAction } from '@/lib/use-action';

export type InboxItem = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  action: string | null;
  urgent: boolean;
  createdAt: Date;
  readAt: Date | null;
};

/** The in-app inbox: open (marks read and goes to the link), mark all read, clear. */
export function InboxList({ items }: { items: InboxItem[] }) {
  const { run, pending } = useAction();
  const router = useRouter();
  const unread = items.some((i) => !i.readAt);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          icon={<CheckIcon />}
          disabled={!unread}
          loading={pending}
          onClick={() => run('notifications.markRead', {})}
        >
          Mark all read
        </Button>
        <Button
          size="sm"
          icon={<XIcon />}
          loading={pending}
          onClick={() => run('notifications.dismiss', {}, { success: 'Inbox cleared' })}
        >
          Clear all
        </Button>
      </div>
      <ul className="grid divide-y divide-hairline rounded-xl border border-hairline bg-card">
        {items.map((n) => (
          <li key={n.id} className={cn('grid gap-1 p-4', !n.readAt && 'bg-tint')}>
            <div className="flex flex-wrap items-center gap-2">
              <p className={cn('min-w-0 break-words', !n.readAt && 'font-semibold')}>{n.title}</p>
              {n.urgent && <Badge color="red">Needs attention</Badge>}
            </div>
            <p className="text-sm break-words text-muted-foreground">{n.body}</p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <span className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
              {n.url && (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={pending}
                  onClick={async () => {
                    const res = await run<{ url: string | null }>(
                      'notifications.open',
                      { id: n.id },
                      { refresh: false },
                    );
                    if (res.ok && res.data.url) router.push(res.data.url);
                  }}
                >
                  {n.action ?? 'Open'}
                </Button>
              )}
              {!n.readAt && !n.url && (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={pending}
                  onClick={() => run('notifications.markRead', { ids: [n.id] })}
                >
                  Mark read
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
