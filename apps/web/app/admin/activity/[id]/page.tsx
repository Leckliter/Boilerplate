import { callAction, getActivity } from '@app/core';
import { Badge } from '@app/ui/components/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/ui/components/card';
import { CodeBlock } from '@app/ui/components/code-block';
import { DetailItem, DetailList } from '@app/ui/components/detail-list';
import { linkVariants } from '@app/ui/components/link';
import { PageHeader, RecordHeader } from '@app/ui/components/page';
import { getServerDates } from '@/lib/dates-server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ActionError } from '@/components/action-error';
import { actorLabel } from '@/components/admin/activity-list';
import { ActivityTimeline } from '@/components/admin/dashboard/activity-timeline';
import { ChangeList } from '@/components/admin/change-list';
import { SUBJECT_LINKS } from '@/lib/labels';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Activity entry' };

const inherit = linkVariants({ tone: 'inherit' });

export default async function ActivityEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { formatDateTime } = await getServerDates();
  const { id } = await params;
  const viewer = await requireViewer('activity.read', `/admin/activity/${id}`);
  const result = await callAction(getActivity, { id }, viewer.actor);
  if (!result.ok) {
    if (result.error.code === 'not_found' || result.error.code === 'invalid_input') notFound();
    return (
      <div className="grid gap-6">
        <PageHeader title="Activity entry" />
        <ActionError error={result.error} what="this entry" />
      </div>
    );
  }
  const { entry: e, changes, sameRequest } = result.data;
  const subjectHref = e.subjectType && e.subjectId && SUBJECT_LINKS[e.subjectType]?.(e.subjectId);
  const input = e.input !== null ? JSON.stringify(e.input, null, 2) : null;

  return (
    <div className="grid gap-6">
      <RecordHeader
        back={<Link href="/admin/activity">← Activity</Link>}
        title={e.summary ?? e.action}
        badges={!e.ok && <Badge color="red">Failed</Badge>}
        meta={
          <>
            {formatDateTime(e.occurredAt)} · {actorLabel(e)}
          </>
        }
      />
      <Card>
        <CardContent>
          <DetailList>
            <DetailItem label="Who">
              {e.actorContactId ? (
                <Link className={inherit} href={`/admin/activity?actor=${e.actorContactId}`}>
                  {actorLabel(e)}
                </Link>
              ) : (
                actorLabel(e)
              )}
            </DetailItem>
            <DetailItem label="App / channel">{e.channel}</DetailItem>
            <DetailItem label="Action">
              <code>{e.action}</code>
            </DetailItem>
            <DetailItem label="Kind">{e.kind}</DetailItem>
            <DetailItem label="About">
              {subjectHref ? (
                <Link className={inherit} href={subjectHref}>
                  {e.subjectType} {e.subjectId}
                </Link>
              ) : e.subjectType ? (
                `${e.subjectType} ${e.subjectId ?? ''}`
              ) : null}
            </DetailItem>
            <DetailItem label="Result">
              {e.ok ? (
                'Succeeded'
              ) : (
                <span className="text-destructive">
                  Failed ({e.errorCode ?? 'error'}): {e.error ?? ''}
                </span>
              )}
            </DetailItem>
            <DetailItem label="Error report" copy={e.errorRef}>
              {e.errorRef &&
                (viewer.can('errors.manage') ? (
                  <Link className={`font-mono ${inherit}`} href={`/admin/errors/${e.errorRef}`}>
                    {e.errorRef}
                  </Link>
                ) : (
                  <code>{e.errorRef}</code>
                ))}
            </DetailItem>
            <DetailItem label="IP address">{e.ip}</DetailItem>
            <DetailItem label="Browser / client">{e.userAgent}</DetailItem>
            <DetailItem label="Request id" copy={e.requestId}>
              {e.requestId && (
                <Link
                  className={`font-mono ${inherit}`}
                  href={`/admin/activity?request=${encodeURIComponent(e.requestId)}`}
                >
                  {e.requestId}
                </Link>
              )}
            </DetailItem>
            <DetailItem label="Took">
              {e.durationMs !== null ? `${e.durationMs} ms` : null}
            </DetailItem>
          </DetailList>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>What changed</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangeList changes={changes} />
        </CardContent>
      </Card>
      {input !== null && (
        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock copy={input}>{input}</CodeBlock>
          </CardContent>
        </Card>
      )}
      {sameRequest.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Same request</CardTitle>
            <CardDescription>Everything else this one request did, in order.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityTimeline
              items={sameRequest.map((r) => ({
                id: r.id,
                summary: r.summary ?? r.action,
                who: `${actorLabel(r)} · ${r.channel}`,
                at: new Date(r.occurredAt).toISOString(),
                ok: r.ok,
              }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
