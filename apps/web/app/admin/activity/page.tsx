import { callAction, listActivity, listContacts } from '@app/core';
import { buttonVariants } from '@app/ui/components/button';
import { Card, CardContent } from '@app/ui/components/card';
import { PageHeader } from '@app/ui/components/page';
import { addDaysToDay, zonedTimeToDate } from '@app/ui/lib/dates';
import Link from 'next/link';

import { ActionError } from '@/components/action-error';
import { ActivityFilters } from '@/components/admin/activity-filters';
import { ActivityList } from '@/components/admin/activity-list';
import { FilterLinks } from '@/components/admin/filter-links';
import { ExportCsvButton } from '@/components/admin/users/export-button';
import { UrlSearch } from '@/components/admin/url-search';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Activity' };

const PAGE_SIZE = 100;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

type Params = {
  kind?: 'change' | 'read' | 'auth';
  channel?: 'web' | 'api' | 'mcp' | 'system' | 'automation';
  failed?: string;
  q?: string;
  before?: string;
  actor?: string;
  key?: string;
  request?: string;
  from?: string;
  to?: string;
};

const KINDS = [
  { value: undefined, label: 'Everything' },
  { value: 'change', label: 'Changes' },
  { value: 'auth', label: 'Sign-ins' },
  { value: 'read', label: 'API / AI reads' },
] as const;

const CHANNELS = ['web', 'api', 'mcp', 'system', 'automation'] as const;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Params> }) {
  const viewer = await requireViewer('activity.read', '/admin/activity');
  const params = await searchParams;
  const kind = KINDS.find((k) => k.value === params.kind)?.value;
  const channel = CHANNELS.find((c) => c === params.channel);
  const failedOnly = params.failed === '1';
  // Dates are calendar days in the app's time zone: "from" is the start of that day, "to" the end of its day.
  const from = params.from && DAY.test(params.from) ? params.from : undefined;
  const to = params.to && DAY.test(params.to) ? params.to : undefined;
  const fromAt = from ? zonedTimeToDate(from) : undefined;
  const toAt = to ? new Date(zonedTimeToDate(addDaysToDay(to, 1)).getTime() - 1) : undefined;
  // The period is the action's own `from` / `to`; `before` is only the paging cursor inside it.
  const before =
    params.before && (!toAt || new Date(params.before) < toAt) ? params.before : undefined;

  const [fetched, people] = await Promise.all([
    callAction(
      listActivity,
      {
        kind,
        channel,
        failedOnly,
        q: params.q && params.q.trim().length >= 2 ? params.q : undefined,
        from: fromAt?.toISOString(),
        to: toAt?.toISOString(),
        before,
        actorContactId: params.actor || undefined,
        apiKeyId: params.key || undefined,
        requestId: params.request || undefined,
        limit: PAGE_SIZE,
      },
      viewer.actor,
    ),
    viewer.can('users.read')
      ? callAction(listContacts, { tag: 'staff', limit: 100 }, viewer.actor)
      : null,
  ]);
  const rows = fetched.ok ? fetched.data : [];
  const href = (change: Partial<Params>) => {
    const next = { ...params, before: undefined, ...change };
    const qs = new URLSearchParams(
      Object.entries(next).filter((e): e is [string, string] => typeof e[1] === 'string'),
    );
    return `/admin/activity${qs.size ? `?${qs}` : ''}`;
  };
  const last = fetched.ok ? fetched.data.at(-1) : undefined;

  return (
    <>
      <PageHeader
        title="Activity"
        description="Every change, sign-in and denied attempt, by whom and from where. Open one for before → after."
        actions={
          viewer.can('data.export') && (
            <ExportCsvButton
              action="activity.exportCsv"
              input={{
                from: fromAt?.toISOString(),
                to: toAt?.toISOString(),
                kind,
                failedOnly,
              }}
            />
          )
        }
      />
      <UrlSearch placeholder="Search summaries and action names…" label="Search activity" />
      <FilterLinks
        className="mb-3"
        label="What happened"
        items={KINDS.map((k) => ({
          href: href({ kind: k.value }),
          label: k.label,
          active: kind === k.value,
        }))}
      />
      <ActivityFilters
        values={{ from, to, actor: params.actor, channel, failed: failedOnly }}
        actors={
          people?.ok ? people.data.contacts.map((c) => ({ id: c.id, name: c.displayName })) : []
        }
        keep={{ kind, q: params.q, key: params.key, request: params.request }}
      />
      <Card>
        <CardContent>
          {fetched.ok ? (
            <ActivityList entries={rows} />
          ) : (
            <ActionError error={fetched.error} what="the activity" />
          )}
        </CardContent>
      </Card>
      {last && fetched.ok && fetched.data.length === PAGE_SIZE && (
        <div className="mt-4 flex justify-end">
          <Link
            href={href({ before: new Date(last.occurredAt).toISOString() })}
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            Older →
          </Link>
        </div>
      )}
    </>
  );
}
