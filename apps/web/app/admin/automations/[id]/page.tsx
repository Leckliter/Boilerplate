import { callAction } from '@app/core';
import { getAutomation } from '@app/core/automations';
import { Badge } from '@app/ui/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@app/ui/components/card';
import { Empty } from '@app/ui/components/empty';
import { PencilSimpleIcon } from '@app/ui/components/icons';
import { LinkButton } from '@app/ui/components/link-button';
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
import { AutomationButtons, EnabledSwitch } from '@/components/automations/automation-actions';
import { describeStep, describeTrigger } from '@/components/automations/describe';
import { RunStatusBadge } from '@/components/automations/status-badge';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Automation' };

export default async function AutomationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer('automations.manage', `/admin/automations/${id}`);
  const res = await callAction(getAutomation, { id }, viewer.actor);
  if (!res.ok) return <ActionError error={res.error} what="the automation" />;
  const { automation: a, runs } = res.data;

  return (
    <div className="grid gap-6">
      <PageHeader
        title={a.name}
        description={a.description ?? describeTrigger(a.trigger)}
        actions={
          <>
            <EnabledSwitch id={a.id} name={a.name} enabled={a.enabled} />
            <LinkButton href={`/admin/automations/${a.id}/edit`} icon={<PencilSimpleIcon />}>
              Edit
            </LinkButton>
            <AutomationButtons id={a.id} name={a.name} />
          </>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>What it does</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <p>
            <strong>{describeTrigger(a.trigger)}</strong>{' '}
            <Badge color="neutral">v{a.version}</Badge>
          </p>
          {a.conditions.length > 0 && (
            <p className="text-muted-foreground">
              Only if{' '}
              {a.conditions
                .map(
                  (c) =>
                    `${c.path} ${c.op}${c.value === undefined ? '' : ` ${JSON.stringify(c.value)}`}`,
                )
                .join(' and ')}
            </p>
          )}
          <ol className="grid list-decimal gap-1 pl-5">
            {a.steps.map((s, i) => (
              <li key={i} className="break-words">
                {describeStep(s as never)}
              </li>
            ))}
          </ol>
          {a.cancelOn.length > 0 && (
            <p className="text-muted-foreground">
              Stops early on {a.cancelOn.map((c) => c.event).join(', ')}.
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
        </CardHeader>
        {runs.length === 0 ? (
          <Empty title="No runs yet" description="Press “Run now” to test it." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.id} className={rowLinkRow}>
                  <TableCell className="max-w-xs">
                    <Link href={`/admin/automations/runs/${r.id}`} className={rowLink}>
                      <code className="text-xs">{r.triggerKey.slice(0, 24)}</code>
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
        )}
      </Card>
    </div>
  );
}
