import { callAction } from '@app/core';
import { listAutomations } from '@app/core/automations';
import { Badge } from '@app/ui/components/badge';
import { Card } from '@app/ui/components/card';
import { Empty } from '@app/ui/components/empty';
import { LightningIcon, PlusIcon } from '@app/ui/components/icons';
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
import { cn } from '@app/ui/lib/utils';
import Link from 'next/link';

import { ActionError } from '@/components/action-error';
import { describeTrigger } from '@/components/automations/describe';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Automations' };

export default async function AutomationsPage() {
  const viewer = await requireViewer('automations.manage', '/admin/automations');
  const res = await callAction(listAutomations, {}, viewer.actor);

  return (
    <>
      <PageHeader
        title="Automations"
        description="When something happens (or on a schedule), do these steps. Runs once, reliably, even when it takes weeks."
        actions={
          <>
            <LinkButton href="/admin/automations/runs" variant="secondary">
              All runs
            </LinkButton>
            <LinkButton href="/admin/automations/new" variant="primary" icon={<PlusIcon />}>
              New automation
            </LinkButton>
          </>
        }
      />
      {!res.ok ? (
        <ActionError error={res.error} what="the automations" />
      ) : res.data.length === 0 ? (
        <Card>
          <Empty
            icon={<LightningIcon />}
            title="No automations yet"
            description="Try “when a contact is created, tell staff”. New automations start off until you turn them on."
            contents={
              <LinkButton href="/admin/automations/new" variant="primary">
                New automation
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
                <TableHead className="hidden md:table-cell">Starts</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="hidden sm:table-cell">Last run</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {res.data.map((a) => (
                <TableRow key={a.id} className={rowLinkRow}>
                  <TableCell className="max-w-xs">
                    <Link
                      href={`/admin/automations/${a.id}`}
                      className={cn('grid gap-0.5', rowLink)}
                    >
                      <span className="truncate font-medium">{a.name}</span>
                      {a.tags.length > 0 && (
                        <span className="truncate text-xs text-muted-foreground">
                          {a.tags.join(', ')}
                        </span>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {describeTrigger(a.trigger)}
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      <Badge color={a.enabled ? 'green' : 'neutral'}>
                        {a.enabled ? 'On' : 'Off'}
                      </Badge>
                      {a.failedRuns30d > 0 && <Badge color="red">{a.failedRuns30d} failed</Badge>}
                      {a.activeRuns > 0 && <Badge color="blue">{a.activeRuns} going</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                    {a.lastRunAt ? formatDateTime(a.lastRunAt) : 'Never'}
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
