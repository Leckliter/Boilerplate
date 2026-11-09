import { callAction } from '@app/core';
import { getRun } from '@app/core/automations';
import { Callout } from '@app/ui/components/callout';
import { Card, CardContent, CardHeader, CardTitle } from '@app/ui/components/card';
import { CodeBlock } from '@app/ui/components/code-block';
import { PageHeader } from '@app/ui/components/page';
import { getServerDates } from '@/lib/dates-server';
import Link from 'next/link';

import { ActionError } from '@/components/action-error';
import { RunButtons } from '@/components/automations/automation-actions';
import { describeStep } from '@/components/automations/describe';
import { RunStatusBadge } from '@/components/automations/status-badge';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Automation run' };

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { formatDateTime } = await getServerDates();
  const { id } = await params;
  const viewer = await requireViewer('automations.manage', `/admin/automations/runs/${id}`);
  const res = await callAction(getRun, { id }, viewer.actor);
  if (!res.ok) return <ActionError error={res.error} what="the run" />;
  const { run, automation, steps } = res.data;

  return (
    <div className="grid gap-6">
      <PageHeader
        title={automation?.name ?? 'Automation run'}
        description={
          <>
            <RunStatusBadge status={run.status} /> started {formatDateTime(run.createdAt)}
            {run.finishedAt ? `, finished ${formatDateTime(run.finishedAt)}` : ''}
            {automation && (
              <>
                {' · '}
                <Link href={`/admin/automations/${automation.id}`} className="underline">
                  the automation
                </Link>
              </>
            )}
          </>
        }
        actions={<RunButtons id={run.id} status={run.status} />}
      />
      {run.error && <Callout tone="danger">{run.error}</Callout>}
      {run.note && <Callout tone="info">{run.note}</Callout>}
      {run.wakeAt && run.status === 'waiting' && (
        <Callout tone="info">
          Waiting{run.waitingEvent ? ` for ${run.waitingEvent}, or` : ' until'}{' '}
          {formatDateTime(run.wakeAt)}.
        </Callout>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Steps</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {steps.map((s) => (
            <div
              key={s.index}
              className="grid min-w-0 gap-1 border-b border-hairline pb-4 last:border-0 last:pb-0"
            >
              <p className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">{s.index + 1}.</span>
                <span className="min-w-0 font-medium break-words">
                  {describeStep(s.step as never)}
                </span>
                <RunStatusBadge status={s.status} />
              </p>
              {s.error && <p className="text-sm break-words text-destructive">{s.error}</p>}
              {s.output != null && <CodeBlock>{JSON.stringify(s.output, null, 2)}</CodeBlock>}
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>What started it</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock>{JSON.stringify(run.trigger, null, 2)}</CodeBlock>
        </CardContent>
      </Card>
    </div>
  );
}
