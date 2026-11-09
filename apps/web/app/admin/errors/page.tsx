import { callAction, errorOccurrences, listErrors } from '@app/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/ui/components/card';
import { Sparkline } from '@app/ui/components/charts';
import { PageHeader } from '@app/ui/components/page';

import { ActionError } from '@/components/action-error';
import { FilterLinks } from '@/components/admin/filter-links';
import { ErrorsTable } from '@/components/admin/errors/errors-table';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Errors' };

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
] as const;

const DAYS = 14;
/** Only this many rows get their own trend (one small query each). */
const TREND_ROWS = 25;

export default async function ErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const viewer = await requireViewer('errors.manage', '/admin/errors');
  const { status: raw } = await searchParams;
  const status = STATUSES.find((s) => s.value === raw)?.value ?? 'open';
  // The counts on the tabs come from the same call with status "all" (one cheap grouped query).
  const [result, all] = await Promise.all([
    callAction(listErrors, { status, sinceDays: 90 }, viewer.actor),
    callAction(listErrors, { status: 'all', sinceDays: 90, limit: 200 }, viewer.actor),
  ]);
  // Each listed bug's own per-day counts (errors.occurrences); the chart above is their sum.
  const trends = result.ok
    ? await Promise.all(
        result.data
          .slice(0, TREND_ROWS)
          .map((g) =>
            callAction(errorOccurrences, { fingerprint: g.fingerprint, days: DAYS }, viewer.actor),
          ),
      )
    : [];
  const trendOf = new Map(
    trends.flatMap((t) =>
      t.ok ? [[t.data.fingerprint, t.data.days.map((d) => d.count)] as const] : [],
    ),
  );
  const perDay = Array.from({ length: DAYS }, (_, i) =>
    [...trendOf.values()].reduce((sum, series) => sum + (series[i] ?? 0), 0),
  );
  const counts = all.ok
    ? {
        open: all.data.filter((g) => g.openCount > 0).length,
        resolved: all.data.filter((g) => g.openCount === 0).length,
        all: all.data.length,
      }
    : null;

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
          count: counts?.[s.value],
        }))}
      />
      {perDay.some(Boolean) && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Errors per day</CardTitle>
            <CardDescription>
              How many times the bugs listed below happened on each of the last {DAYS} days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Sparkline
              data={perDay}
              label={`Errors per day, last ${DAYS} days`}
              series={3}
              className="h-12 w-full max-w-md"
            />
          </CardContent>
        </Card>
      )}
      {!result.ok ? (
        <ActionError error={result.error} what="the errors" />
      ) : (
        <ErrorsTable
          canResolve
          rows={result.data.map((g) => ({
            ref: g.ref,
            fingerprint: g.fingerprint,
            message: g.message,
            code: g.code,
            where: g.action ?? g.path ?? g.source,
            count: g.count,
            openCount: g.openCount,
            lastSeen: new Date(g.lastSeen).toISOString(),
            trend: trendOf.get(g.fingerprint),
          }))}
        />
      )}
    </>
  );
}
