import { callAction } from '@app/core';
import { listRuns } from '@app/core/automations';
import { Card } from '@app/ui/components/card';
import { Empty } from '@app/ui/components/empty';
import { LinkButton } from '@app/ui/components/link-button';
import { LightningIcon } from '@app/ui/components/icons';
import { rowLink, rowLinkRow } from '@app/ui/components/link';
import { PageHeader } from '@app/ui/components/page';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@app/ui/components/table';
import { formatDateTime } from '@app/ui/lib/dates';
import Link from 'next/link';

import { ActionError } from '@/components/action-error';
import { FilterLinks } from '@/components/admin/filter-links';
import { RunStatusBadge } from '@/components/automations/status-badge';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Automation runs' };

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'failed', label: 'Failed' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'running', label: 'Running' },
] as const;

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const viewer = await requireViewer('automations.manage', '/admin/automations/runs');
  const raw = (await searchParams).status;
  const status = FILTERS.find((f) => f.value === raw)?.value ?? 'all';
  const res = await callAction(
    listRuns,
    { limit: 100, ...(status !== 'all' && { status: [status] }) },
    viewer.actor,
  );
  return (
    <>
      <PageHeader
        title="Automation runs"
        description="Every run of every automation, newest first."
      />
      <FilterLinks
        className="mb-4"
        label="Run status"
        items={FILTERS.map((f) => ({
          href:
            f.value === 'all'
              ? '/admin/automations/runs'
              : `/admin/automations/runs?status=${f.value}`,
          label: f.label,
          active: f.value === status,
        }))}
      />
      {!res.ok ? (
        <ActionError error={res.error} what="the runs" />
      ) : res.data.length === 0 ? (
        <Card>
          <Empty
            icon={<LightningIcon />}
            title="No runs"
            description="Runs show up here when an automation starts."
            contents={
              <LinkButton href="/admin/automations" variant="primary">
                Open automations
              </LinkButton>
            }
          />
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Automation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {res.data.map((r) => (
                <TableRow key={r.id} className={rowLinkRow}>
                  <TableCell className="max-w-xs">
                    <Link href={`/admin/automations/runs/${r.id}`} className={rowLink}>
                      <span className="block truncate font-medium">{r.automationName}</span>
                    </Link>
                    {(r.error ?? r.note) && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {r.error ?? r.note}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <RunStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                    {formatDateTime(r.createdAt)}
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
