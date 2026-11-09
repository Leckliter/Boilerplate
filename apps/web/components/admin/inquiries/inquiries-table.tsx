'use client';

import { DataTable, type DataTableColumn } from '@app/ui/components/data-table';
import { Empty } from '@app/ui/components/empty';
import { TrayIcon } from '@app/ui/components/icons';
import { useDates } from '@app/ui/components/ui-context';
import Link from 'next/link';

import { InquiryStatusBadge } from '@/components/admin/status-badges';

export type InquiryRow = {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: string;
  createdAt: string;
};

/** The inquiries list: the name opens the inquiry; on a phone each row is a card. Sorting is within the page. */
export function InquiriesTable({ rows, filtered }: { rows: InquiryRow[]; filtered: boolean }) {
  const { formatWhen } = useDates();
  const columns: DataTableColumn<InquiryRow>[] = [
    {
      id: 'from',
      header: 'From',
      label: 'From',
      hideLabelOnCard: true,
      sortValue: (r) => r.name,
      cell: (r) => (
        <Link
          href={`/admin/inquiries/${r.id}`}
          className="grid min-w-0 rounded-md outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="truncate font-medium">{r.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{r.email}</span>
        </Link>
      ),
    },
    {
      id: 'message',
      header: 'Message',
      className: 'max-w-md',
      cell: (r) => (
        <span className="block truncate">
          {r.subject && <span className="font-medium">{r.subject} · </span>}
          <span className="text-muted-foreground">{r.message}</span>
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortValue: (r) => r.status,
      cell: (r) => <InquiryStatusBadge status={r.status} />,
    },
    {
      id: 'received',
      header: 'Received',
      sortValue: (r) => new Date(r.createdAt),
      cell: (r) => <span className="text-muted-foreground">{formatWhen(r.createdAt)}</span>,
    },
  ];
  return (
    <DataTable
      caption="Website inquiries"
      rows={rows}
      columns={columns}
      getRowId={(r) => r.id}
      defaultSort={{ id: 'received', direction: 'desc' }}
      empty={
        <Empty
          icon={<TrayIcon />}
          title={filtered ? 'No inquiries match' : 'No inquiries yet'}
          description={
            filtered
              ? 'Try another tab or a different search.'
              : 'Messages sent from the website contact form land here.'
          }
          contents={
            filtered ? undefined : (
              <Link
                href="/contact"
                className="text-sm font-medium text-primary underline underline-offset-4"
              >
                Open the contact form
              </Link>
            )
          }
        />
      }
    />
  );
}
