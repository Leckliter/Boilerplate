import { callAction, errorOccurrences, getError } from '@app/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/ui/components/card';
import { Sparkline } from '@app/ui/components/charts';
import { CodeBlock } from '@app/ui/components/code-block';
import { CopyButton } from '@app/ui/components/copy-button';
import { DetailItem, DetailList } from '@app/ui/components/detail-list';
import { linkVariants } from '@app/ui/components/link';
import { PageHeader, RecordHeader } from '@app/ui/components/page';
import { getServerDates } from '@/lib/dates-server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ActionError } from '@/components/action-error';
import { actorLabel } from '@/components/admin/activity-list';
import { ErrorStatusBadge } from '@/components/admin/status-badges';
import { requireViewer } from '@/lib/viewer';

import { ResolveForm } from './resolve-form';

export const metadata = { title: 'Error report' };

const json = (v: unknown) => {
  const text = JSON.stringify(v, null, 2);
  return <CodeBlock copy={text}>{text}</CodeBlock>;
};

export default async function ErrorPage({ params }: { params: Promise<{ ref: string }> }) {
  const { formatDateTime } = await getServerDates();
  const { ref } = await params;
  const viewer = await requireViewer('errors.manage', `/admin/errors/${ref}`);
  const result = await callAction(getError, { ref: decodeURIComponent(ref) }, viewer.actor);
  if (!result.ok) {
    if (result.error.code === 'not_found') notFound();
    return (
      <div className="grid gap-6">
        <PageHeader title="Error report" />
        <ActionError error={result.error} what="this error report" />
      </div>
    );
  }
  const { error: e, occurrences, recentRefs, brief } = result.data;
  // How often this bug happened, per day (errors.occurrences).
  const trend = await callAction(
    errorOccurrences,
    { fingerprint: e.fingerprint, days: 14 },
    viewer.actor,
  );
  const perDay = trend.ok ? trend.data.days.map((d) => d.count) : [];

  return (
    <div className="grid gap-6">
      <RecordHeader
        back={<Link href="/admin/errors">← Errors</Link>}
        title={e.message}
        badges={<ErrorStatusBadge resolved={Boolean(e.resolvedAt)} />}
        meta={
          <>
            <code className="font-medium text-foreground">{e.ref}</code> ·{' '}
            {formatDateTime(e.occurredAt)}
          </>
        }
        actions={
          <>
            <CopyButton value={e.ref}>Copy reference</CopyButton>
            <CopyButton value={brief} variant="primary">
              Copy for AI agent
            </CopyButton>
          </>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>
            Diagnosis: <code>{e.code}</code>
          </CardTitle>
          <CardDescription>{e.hint}</CardDescription>
        </CardHeader>
        <CardContent>
          <DetailList>
            <DetailItem label="Environment">
              {e.environment}
              {e.release ? ` · commit ${e.release.slice(0, 7)}` : ''}
            </DetailItem>
            <DetailItem label="Where">
              {[e.source, e.action, e.method, e.path].filter(Boolean).join(' · ')}
            </DetailItem>
            <DetailItem label="Who">
              {actorLabel({
                actorKind: e.actorKind,
                actorName: result.data.actorName,
                apiKeyName: result.data.apiKeyName,
              })}
            </DetailItem>
            <DetailItem label="Seen">
              {occurrences.count}× ({occurrences.openCount} open) · first{' '}
              {formatDateTime(occurrences.firstSeen)} · last {formatDateTime(occurrences.lastSeen)}
            </DetailItem>
            {perDay.some(Boolean) && (
              <DetailItem label="Per day">
                <span className="grid gap-1">
                  <Sparkline
                    data={perDay}
                    label={`Times this error happened per day, last 14 days`}
                    series={3}
                    width="fill"
                    height={40}
                    className="max-w-xs"
                  />
                  <span className="text-xs text-muted-foreground">
                    Times per day, last 14 days.
                  </span>
                </span>
              </DetailItem>
            )}
            <DetailItem label="IP / browser">
              {[e.ip, e.userAgent].filter(Boolean).join(' · ')}
            </DetailItem>
            <DetailItem label="Request" copy={e.requestId}>
              {e.requestId && (
                <Link
                  className={`font-mono ${linkVariants({ tone: 'inherit' })}`}
                  href={`/admin/activity?request=${encodeURIComponent(e.requestId)}`}
                >
                  {e.requestId}
                </Link>
              )}
            </DetailItem>
          </DetailList>
        </CardContent>
      </Card>
      {e.stack && (
        <Card>
          <CardHeader>
            <CardTitle>Stack trace</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock copy={e.stack}>{e.stack}</CodeBlock>
          </CardContent>
        </Card>
      )}
      {Array.isArray(e.causes) && e.causes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Caused by</CardTitle>
          </CardHeader>
          <CardContent>{json(e.causes)}</CardContent>
        </Card>
      )}
      {e.input !== null && (
        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>Passwords, keys and card details are redacted.</CardDescription>
          </CardHeader>
          <CardContent>{json(e.input)}</CardContent>
        </Card>
      )}
      {e.context !== null && (
        <Card>
          <CardHeader>
            <CardTitle>Context</CardTitle>
          </CardHeader>
          <CardContent>{json(e.context)}</CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{e.resolvedAt ? 'Fixed' : 'Mark fixed'}</CardTitle>
          <CardDescription>
            {e.resolvedAt
              ? `${formatDateTime(e.resolvedAt)} — ${e.resolution}`
              : 'Closes this error and every repeat of it. If it happens again, it reopens.'}
            {recentRefs.length > 0 && ` Other occurrences: ${recentRefs.join(', ')}.`}
          </CardDescription>
        </CardHeader>
        {!e.resolvedAt && (
          <CardContent>
            <ResolveForm reference={e.ref} />
          </CardContent>
        )}
      </Card>
    </div>
  );
}
