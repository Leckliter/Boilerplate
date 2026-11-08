import { callAction, listJobs, systemHealth } from '@app/core';
import { Badge } from '@app/ui/components/badge';
import { Callout } from '@app/ui/components/callout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/ui/components/card';
import { Empty } from '@app/ui/components/empty';
import { ClockCountdownIcon } from '@app/ui/components/icons';
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
import { JobButtons } from '@/components/admin/job-buttons';
import { JobStatusBadge } from '@/components/admin/status-badges';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'System' };

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Waiting' },
  { value: 'running', label: 'Running' },
  { value: 'done', label: 'Done' },
] as const;

const when = (d: Date | null) => (d ? formatDateTime(d) : '—');

/** Health, scheduled jobs (crons) and the background-job queue, with retry / cancel. */
export default async function SystemPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const viewer = await requireViewer('system.manage', '/admin/system');
  const { status: raw } = await searchParams;
  const status = STATUSES.find((s) => s.value === raw)?.value ?? 'all';
  const [health, jobs] = await Promise.all([
    callAction(systemHealth, {}, viewer.actor),
    callAction(
      listJobs,
      { status: status === 'all' ? undefined : [status], limit: 50 },
      viewer.actor,
    ),
  ]);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="System"
        description="Is everything running? Database, scheduled jobs and the background queue."
      />
      {!health.ok ? (
        <ActionError error={health.error} what="the system health" />
      ) : (
        <>
          {!health.data.ok && (
            <Callout tone="danger">
              Something needs attention:{' '}
              {Object.entries(health.data.checks)
                .filter(([, c]) => !c.ok)
                .map(([k]) => k)
                .join(', ')}
              .
            </Callout>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Environment</p>
              <p className="mt-1 text-xl font-semibold capitalize">{health.data.environment}</p>
              <p className="text-xs text-muted-foreground">
                {health.data.commit ? `commit ${health.data.commit}` : 'no commit id'}
              </p>
            </Card>
            {Object.entries(health.data.checks)
              .filter(([k]) => !k.startsWith('cron/'))
              .map(([k, c]) => (
                <Card key={k} className="p-4">
                  <p className="text-sm text-muted-foreground capitalize">{k}</p>
                  <p className="mt-1 flex items-center gap-2 text-xl font-semibold">
                    {c.ok ? <Badge color="green">OK</Badge> : <Badge color="red">Failing</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.detail}</p>
                </Card>
              ))}
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Job queue</p>
              <p className="mt-1 text-sm">
                {Object.entries(health.data.queues.jobs).length === 0
                  ? 'Empty'
                  : Object.entries(health.data.queues.jobs)
                      .map(([s, n]) => `${n} ${s}`)
                      .join(' · ')}
              </p>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Scheduled jobs</CardTitle>
              <CardDescription>
                Each cron route records a run. A job is stale when its last OK run is older than
                twice its interval. Point your scheduler at{' '}
                <code className="text-xs">/api/cron/*</code> with{' '}
                <code className="text-xs">CRON_SECRET</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Last OK</TableHead>
                    <TableHead className="hidden md:table-cell">Last error</TableHead>
                    <TableHead>State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {health.data.crons.map((c) => (
                    <TableRow key={c.job}>
                      <TableCell>
                        <span className="font-medium">{c.label}</span>
                        <code className="block text-xs text-muted-foreground">{c.job}</code>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{when(c.lastOkAt)}</TableCell>
                      <TableCell className="hidden max-w-xs truncate text-xs text-muted-foreground md:table-cell">
                        {c.lastError ?? '—'}
                      </TableCell>
                      <TableCell>
                        {c.stale ? (
                          <Badge color="red">Stale</Badge>
                        ) : c.lastOkAt ? (
                          <Badge color="green">Running</Badge>
                        ) : (
                          <Badge color="outline">Not run here</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <div className="grid gap-4">
        <h2 className="text-lg font-semibold">Background jobs</h2>
        <FilterLinks
          label="Job status"
          items={STATUSES.map((s) => ({
            href: `/admin/system?status=${s.value}`,
            label: s.label,
            active: s.value === status,
          }))}
        />
        <Card>
          {!jobs.ok ? (
            <div className="p-5">
              <ActionError error={jobs.error} what="the jobs" />
            </div>
          ) : jobs.data.length === 0 ? (
            <Empty
              icon={<ClockCountdownIcon />}
              title="No jobs here"
              description="Jobs are queued by actions (enqueue) and run by the jobs cron every minute."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Runs / ran</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.data.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="max-w-xs">
                      <code className="text-xs font-medium">{j.type}</code>
                      <span className="block truncate text-xs text-muted-foreground">
                        {j.lastError ?? `${j.attempts}/${j.maxAttempts} attempts`}
                        {j.errorRef && (
                          <>
                            {' · '}
                            <Link
                              href={`/admin/errors/${j.errorRef}`}
                              className="underline underline-offset-4"
                            >
                              {j.errorRef}
                            </Link>
                          </>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <JobStatusBadge status={j.status} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {when(j.finishedAt ?? j.runAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <JobButtons id={j.id} status={j.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
