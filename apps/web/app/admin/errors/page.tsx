import { callAction, listErrors } from '@app/core';
import { Card } from '@app/ui/components/card';
import { rowLink, rowLinkRow } from '@app/ui/components/link';
import { PageHeader } from '@app/ui/components/page';
import { Empty } from '@app/ui/components/empty';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@app/ui/components/table';
import { BugIcon } from '@app/ui/components/icons';
import { cn } from '@app/ui/lib/utils';
import Link from 'next/link';

import { ActionError } from '@/components/action-error';
import { timeFormat } from '@/components/admin/activity-list';
import { FilterLinks } from '@/components/admin/filter-links';
import { ErrorStatusBadge } from '@/components/admin/status-badges';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Errors' };

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Fixed' },
  { value: 'all', label: 'All' },
] as const;

export default async function ErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const viewer = await requireViewer('errors.manage', '/admin/errors');
  const { status: raw } = await searchParams;
  const status = STATUSES.find((s) => s.value === raw)?.value ?? 'open';
  const result = await callAction(listErrors, { status, sinceDays: 90 }, viewer.actor);

  return (
    <>
      <PageHeader
        title="Errors"
        description="Bugs and outages, with repeats grouped. Open one to copy it for an AI agent."
      />
      <FilterLinks
        className="mb-4"
        label="Error status"
        items={STATUSES.map((s) => ({
          href: `/admin/errors?status=${s.value}`,
          label: s.label,
          active: s.value === status,
        }))}
      />
      {!result.ok ? (
        <ActionError error={result.error} what="the errors" />
      ) : result.data.length === 0 ? (
        <Card>
          <Empty
            icon={<BugIcon />}
            title={status === 'open' ? 'No open errors' : 'Nothing here'}
            description="Errors from the last 90 days show up here."
          />
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Error</TableHead>
                <TableHead className="hidden md:table-cell">Where</TableHead>
                <TableHead className="text-right">Times</TableHead>
                <TableHead className="hidden sm:table-cell">Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((g) => (
                <TableRow key={g.fingerprint} className={rowLinkRow}>
                  <TableCell className="max-w-md">
                    <Link href={`/admin/errors/${g.ref}`} className={cn('grid gap-0.5', rowLink)}>
                      <span className="truncate font-medium">{g.message}</span>
                      <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <code>{g.ref}</code>
                        <ErrorStatusBadge resolved={!g.openCount} />
                        <code>{g.code}</code>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                    {g.action ?? g.path ?? g.source}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{g.count}</TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                    {timeFormat.format(new Date(g.lastSeen))}
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
