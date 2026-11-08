import { callAction, listActivity, listContacts, listErrors, systemHealth } from '@app/core';
import { Badge } from '@app/ui/components/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/ui/components/card';
import { PageHeader } from '@app/ui/components/page';
import { formatDateTime } from '@app/ui/lib/dates';
import Link from 'next/link';

import { ActionError } from '@/components/action-error';
import { ActivityList, timeFormat } from '@/components/admin/activity-list';
import { ErrorStatusBadge } from '@/components/admin/status-badges';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Dashboard' };

function Tile({ label, value, hint, href, tone }: { label: string; value: React.ReactNode; hint?: string; href?: string; tone?: 'bad' | 'ok' }) {
  const body = (
    <Card className="h-full p-4 transition-colors hover:bg-tint">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tracking-tight tabular-nums ${tone === 'bad' ? 'text-destructive' : ''}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    body
  );
}

/** The admin home: counts, what just happened, open errors and whether the scheduled jobs are running. Each block shows only what the viewer may read. */
export default async function AdminDashboard() {
  const viewer = await requireViewer('admin.access', '/admin');
  const [users, activity, errors, health] = await Promise.all([
    viewer.can('users.read') ? callAction(listContacts, { limit: 1 }, viewer.actor) : null,
    viewer.can('activity.read') ? callAction(listActivity, { limit: 8 }, viewer.actor) : null,
    viewer.can('errors.manage') ? callAction(listErrors, { status: 'open', sinceDays: 30, limit: 5 }, viewer.actor) : null,
    viewer.can('system.manage') ? callAction(systemHealth, {}, viewer.actor) : null,
  ]);
  const openErrors = errors?.ok ? errors.data.length : null;
  const failedJobs = health?.ok ? (health.data.queues.jobs.failed ?? 0) : null;
  const staleCrons = health?.ok ? health.data.crons.filter((c) => c.stale).length : null;

  return (
    <div className="grid gap-6">
      <PageHeader title={`Welcome back, ${viewer.displayName.split(' ')[0]}`} description="What is happening across the app." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {users?.ok && <Tile label="Users" value={users.data.total} href="/admin/users" hint="Active contacts" />}
        {openErrors !== null && (
          <Tile label="Open errors" value={errors?.ok && errors.data.length === 5 ? '5+' : openErrors} href="/admin/errors" tone={openErrors > 0 ? 'bad' : 'ok'} hint="Last 30 days" />
        )}
        {failedJobs !== null && <Tile label="Failed jobs" value={failedJobs} href="/admin/system" tone={failedJobs > 0 ? 'bad' : 'ok'} hint="Background queue" />}
        {health?.ok && (
          <Tile label="Scheduled jobs" value={staleCrons ? `${staleCrons} stale` : 'Healthy'} href="/admin/system" tone={staleCrons ? 'bad' : 'ok'} hint={`${health.data.environment}${health.data.commit ? ` · ${health.data.commit}` : ''}`} />
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {activity && (
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>
                <Link href="/admin/activity" className="underline underline-offset-4">
                  See all activity
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent>{activity.ok ? <ActivityList entries={activity.data} /> : <ActionError error={activity.error} what="the activity" />}</CardContent>
          </Card>
        )}
        <div className="grid gap-6">
          {errors && (
            <Card>
              <CardHeader>
                <CardTitle>Open errors</CardTitle>
                <CardDescription>Bugs and outages, repeats grouped.</CardDescription>
              </CardHeader>
              <CardContent>
                {!errors.ok ? (
                  <ActionError error={errors.error} what="the errors" />
                ) : errors.data.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open errors. Nice.</p>
                ) : (
                  <ul className="grid gap-2">
                    {errors.data.map((e) => (
                      <li key={e.fingerprint}>
                        <Link href={`/admin/errors/${e.ref}`} className="-mx-2 flex items-start gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{e.message}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {e.ref} · {e.count}× · last {timeFormat.format(new Date(e.lastSeen))}
                            </span>
                          </span>
                          <ErrorStatusBadge resolved={!e.openCount} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
          {health && (
            <Card>
              <CardHeader>
                <CardTitle>Scheduled jobs</CardTitle>
                <CardDescription>Cron health: each job should have run recently.</CardDescription>
              </CardHeader>
              <CardContent>
                {!health.ok ? (
                  <ActionError error={health.error} what="the system health" />
                ) : (
                  <ul className="grid gap-2 text-sm">
                    {health.data.crons.map((c) => (
                      <li key={c.job} className="flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0">
                          <span className="font-medium">{c.label}</span>
                          <span className="block text-xs text-muted-foreground">
                            {c.lastOkAt ? `Last OK ${formatDateTime(c.lastOkAt)}` : 'Has not run here yet'}
                          </span>
                        </span>
                        {c.stale ? <Badge color="red">Stale</Badge> : c.lastOkAt ? <Badge color="green">Running</Badge> : <Badge color="outline">Unknown</Badge>}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
