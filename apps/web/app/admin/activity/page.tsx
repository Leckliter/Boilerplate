import { callAction, listActivity } from '@app/core';
import { buttonVariants } from '@app/ui/components/button';
import { Card, CardContent } from '@app/ui/components/card';
import { PageHeader } from '@app/ui/components/page';
import Link from 'next/link';

import { ActionError } from '@/components/action-error';
import { ActivityList } from '@/components/admin/activity-list';
import { FilterLinks } from '@/components/admin/filter-links';
import { UrlSearch } from '@/components/admin/url-search';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Activity' };

const PAGE_SIZE = 100;

type Params = {
  kind?: 'change' | 'read' | 'auth';
  channel?: 'web' | 'api' | 'mcp' | 'system';
  failed?: string;
  q?: string;
  before?: string;
  actor?: string;
  key?: string;
  request?: string;
};

const KINDS = [
  { value: undefined, label: 'Everything' },
  { value: 'change', label: 'Changes' },
  { value: 'auth', label: 'Sign-ins' },
  { value: 'read', label: 'API / AI reads' },
] as const;

const CHANNELS = [
  { value: undefined, label: 'All apps' },
  { value: 'web', label: 'Web' },
  { value: 'api', label: 'API' },
  { value: 'mcp', label: 'AI (MCP)' },
  { value: 'system', label: 'System' },
] as const;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Params> }) {
  const viewer = await requireViewer('activity.read', '/admin/activity');
  const params = await searchParams;
  const kind = KINDS.find((k) => k.value === params.kind)?.value;
  const channel = CHANNELS.find((c) => c.value === params.channel)?.value;
  const failedOnly = params.failed === '1';
  const result = await callAction(
    listActivity,
    {
      kind,
      channel,
      failedOnly,
      q: params.q && params.q.trim().length >= 2 ? params.q : undefined,
      before: params.before,
      actorContactId: params.actor,
      apiKeyId: params.key,
      requestId: params.request,
      limit: PAGE_SIZE,
    },
    viewer.actor,
  );
  const href = (change: Partial<Params>) => {
    const next = { ...params, before: undefined, ...change };
    const qs = new URLSearchParams(
      Object.entries(next).filter((e): e is [string, string] => typeof e[1] === 'string'),
    );
    return `/admin/activity${qs.size ? `?${qs}` : ''}`;
  };
  const last = result.ok ? result.data.at(-1) : undefined;

  return (
    <>
      <PageHeader
        title="Activity"
        description="Every change, sign-in and denied attempt, by whom and from where. Open one for before → after."
      />
      <UrlSearch placeholder="Search summaries and action names…" label="Search activity" />
      <div className="mb-4 grid gap-3">
        <FilterLinks
          label="What happened"
          items={KINDS.map((k) => ({
            href: href({ kind: k.value }),
            label: k.label,
            active: kind === k.value,
          }))}
        />
        <FilterLinks
          label="Where"
          items={[
            ...CHANNELS.map((c) => ({
              href: href({ channel: c.value }),
              label: c.label,
              active: channel === c.value,
            })),
            {
              href: href({ failed: failedOnly ? undefined : '1' }),
              label: 'Failed & denied only',
              active: failedOnly,
            },
            ...(params.actor || params.key || params.request
              ? [
                  {
                    href: href({ actor: undefined, key: undefined, request: undefined }),
                    label: `${params.request ? 'One request' : 'One person / key'} ✕`,
                    active: true,
                  },
                ]
              : []),
          ]}
        />
      </div>
      <Card>
        <CardContent>
          {result.ok ? (
            <ActivityList entries={result.data} />
          ) : (
            <ActionError error={result.error} what="the activity" />
          )}
        </CardContent>
      </Card>
      {last && result.ok && result.data.length === PAGE_SIZE && (
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
