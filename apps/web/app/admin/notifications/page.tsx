import { callAction } from '@app/core';
import { listDeliveries } from '@app/core/notifications';
import { Card } from '@app/ui/components/card';
import { Empty } from '@app/ui/components/empty';
import { SendTestButton } from '@/components/notifications/send-test-button';
import { BellIcon } from '@app/ui/components/icons';
import { PageHeader } from '@app/ui/components/page';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@app/ui/components/table';
import { getServerDates } from '@/lib/dates-server';
import Link from 'next/link';

import { ActionError } from '@/components/action-error';
import { FilterLinks } from '@/components/admin/filter-links';
import { DeliveryBadge } from '@/components/notifications/delivery-badge';
import { RetryDeliveryButton } from '@/components/notifications/retry-delivery-button';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Notifications' };

const STATUSES = ['all', 'failed', 'pending', 'sent', 'skipped'] as const;
const CHANNELS = ['all', 'email', 'sms', 'push'] as const;
type Status = (typeof STATUSES)[number];
type Channel = (typeof CHANNELS)[number];

const label = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; channel?: string }>;
}) {
  const { formatDateTime } = await getServerDates();
  const viewer = await requireViewer('notifications.manage', '/admin/notifications');
  const raw = await searchParams;
  const status: Status = STATUSES.find((s) => s === raw.status) ?? 'all';
  const channel: Channel = CHANNELS.find((c) => c === raw.channel) ?? 'all';
  const href = (s: Status, c: Channel) => {
    const q = new URLSearchParams();
    if (s !== 'all') q.set('status', s);
    if (c !== 'all') q.set('channel', c);
    return `/admin/notifications${q.size ? `?${q}` : ''}`;
  };
  const res = await callAction(
    listDeliveries,
    {
      limit: 100,
      ...(status !== 'all' && { status: status as 'failed' | 'pending' | 'sent' | 'skipped' }),
      ...(channel !== 'all' && { channel }),
    },
    viewer.actor,
  );

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Every email, text and push we sent (or chose not to), newest first. Retry a failed one after fixing the cause."
      />
      <div className="mb-4 grid gap-2">
        <FilterLinks
          label="Status"
          items={STATUSES.map((s) => ({
            href: href(s, channel),
            label: label(s),
            active: s === status,
          }))}
        />
        <FilterLinks
          label="Channel"
          items={CHANNELS.map((c) => ({
            href: href(status, c),
            label: c === 'all' ? 'Any channel' : label(c),
            active: c === channel,
          }))}
        />
      </div>
      {!res.ok ? (
        <ActionError error={res.error} what="the delivery log" />
      ) : res.data.length === 0 ? (
        <Card>
          <Empty
            icon={<BellIcon />}
            title="No deliveries"
            description="Nothing matches. Messages show up here as soon as the app sends one."
            contents={<SendTestButton />}
          />
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Message</TableHead>
                <TableHead className="hidden md:table-cell">To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">When</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {res.data.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="max-w-xs">
                    <span className="block truncate font-medium">{d.title}</span>
                    <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                      <code>{d.type}</code>
                      <span>{d.channel}</span>
                    </span>
                    {d.lastError && (
                      <span className="block text-xs break-words text-destructive">
                        {d.lastError}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Link
                      href={`/admin/users/${d.contactId}`}
                      className="font-medium hover:underline"
                    >
                      {d.contactName}
                    </Link>
                    <span className="block text-xs break-all text-muted-foreground">{d.to}</span>
                  </TableCell>
                  <TableCell>
                    <DeliveryBadge status={d.status} />
                    {d.attempts > 1 && (
                      <span className="block text-xs text-muted-foreground">
                        {d.attempts} tries
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                    {formatDateTime(d.sentAt ?? d.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {(d.status === 'failed' || d.status === 'skipped') && (
                      <RetryDeliveryButton id={d.id} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
