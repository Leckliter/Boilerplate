import {
  callAction,
  listActivity,
  listContacts,
  listErrors,
  listSettings,
  listStaff,
  listTags,
  systemHealth,
  systemIntegrations,
} from '@app/core';
import { listDeliveries } from '@app/core/notifications';
import { Badge } from '@app/ui/components/badge';
import { BarChart, DonutChart, Sparkline } from '@app/ui/components/charts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/ui/components/card';
import { Empty } from '@app/ui/components/empty';
import {
  BugIcon,
  ChartBarIcon,
  ClockCountdownIcon,
  PulseIcon,
  UsersIcon,
} from '@app/ui/components/icons';
import { PageHeader } from '@app/ui/components/page';
import { StatTile } from '@app/ui/components/stat-tile';
import { Pill } from '@app/ui/components/pill';
import { formatDateTime } from '@app/ui/lib/dates';
import Link from 'next/link';

import { ActionError } from '@/components/action-error';
import { actorLabel } from '@/components/admin/activity-list';
import { ActivityTimeline } from '@/components/admin/dashboard/activity-timeline';
import { GettingStarted, type SetupStep } from '@/components/admin/dashboard/getting-started';
import { ErrorStatusBadge } from '@/components/admin/status-badges';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';
import { devLoginEnabled } from '@/lib/auth/dev';
import { ONBOARDING_SETTING } from '@/lib/settings-keys';
import { SITE } from '@/lib/site';
import { countByDay, dayLabels, lastDays, withinHours } from '@/lib/admin-stats';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Dashboard' };

const DAYS = 14;

/** A tile that links to where the number comes from. */
function TileLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring [&>[data-slot=stat-tile]]:h-full [&>[data-slot=stat-tile]]:transition-colors hover:[&>[data-slot=stat-tile]]:bg-tint"
    >
      {children}
    </Link>
  );
}

/**
 * The admin home, composed from existing actions only (nothing here queries a table): people (users by
 * type, new this week), errors (open now / last 24 h), the audit trail (events per day, recent activity),
 * notification deliveries and scheduled-job health, plus the owner's first-run checklist. Each block shows
 * only what the viewer may read, and every query is a small, capped list call.
 */
export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const viewer = await requireViewer('admin.access', '/admin');
  const { welcome } = await searchParams;
  const isOwner = viewer.roles.includes('owner');
  const [
    users,
    allUsers,
    tags,
    activity,
    errors,
    health,
    deliveries,
    integrations,
    settings,
    staff,
  ] = await Promise.all([
    viewer.can('users.read') ? callAction(listContacts, { limit: 200 }, viewer.actor) : null,
    viewer.can('users.read')
      ? callAction(listContacts, { limit: 1, includeArchived: true }, viewer.actor)
      : null,
    viewer.can('users.read') ? callAction(listTags, {}, viewer.actor) : null,
    viewer.can('activity.read') ? callAction(listActivity, { limit: 200 }, viewer.actor) : null,
    viewer.can('errors.manage')
      ? callAction(listErrors, { status: 'open', sinceDays: 30, limit: 100 }, viewer.actor)
      : null,
    viewer.can('system.manage') ? callAction(systemHealth, {}, viewer.actor) : null,
    viewer.can('notifications.manage')
      ? callAction(listDeliveries, { limit: 200 }, viewer.actor)
      : null,
    isOwner && viewer.can('system.manage')
      ? callAction(systemIntegrations, {}, viewer.actor)
      : null,
    isOwner && viewer.can('settings.manage') ? callAction(listSettings, {}, viewer.actor) : null,
    isOwner && viewer.can('roles.manage') ? callAction(listStaff, {}, viewer.actor) : null,
  ]);

  const days = lastDays(DAYS);
  const firstName = viewer.displayName.split(' ')[0];

  // People
  const activeUsers = users?.ok ? users.data.total : null;
  const archivedUsers =
    activeUsers !== null && allUsers?.ok ? allUsers.data.total - activeUsers : null;
  const signups = users?.ok
    ? countByDay(
        users.data.contacts.map((c) => c.createdAt),
        days,
      )
    : [];
  const newThisWeek = signups.slice(-7).reduce((a, b) => a + b, 0);
  const types = tags?.ok ? tags.data.filter((t) => t.kind === 'type' && t.contactCount > 0) : [];

  // Errors
  const openErrors = errors?.ok ? errors.data : [];
  const errors24h = openErrors.filter((e) => withinHours(e.lastSeen, 24)).length;

  // Activity
  const events = activity?.ok ? activity.data : [];
  const perDay = countByDay(
    events.map((e) => e.occurredAt),
    days,
  );
  const failed24h = events.filter((e) => !e.ok && withinHours(e.occurredAt, 24)).length;

  // Notification deliveries by status
  const byStatus = new Map<string, number>();
  if (deliveries?.ok)
    for (const d of deliveries.data) byStatus.set(d.status, (byStatus.get(d.status) ?? 0) + 1);

  // Scheduled jobs
  const crons = health?.ok ? health.data.crons : [];
  const stale = crons.filter((c) => c.stale).length;
  const failedJobs = health?.ok ? (health.data.queues.jobs.failed ?? 0) : 0;

  // Getting started (owner only): every step is derived from real state.
  const integrationDone = (id: string) =>
    integrations?.ok ? Boolean(integrations.data.find((i) => i.id === id)?.configured) : false;
  const steps: SetupStep[] = [
    {
      id: 'email',
      title: 'Set up email',
      text: 'So sign-in codes, receipts and alerts can be delivered.',
      done: integrationDone('email'),
      href: '/admin/settings/integrations',
      cta: 'Integrations',
    },
    {
      id: 'storage',
      title: 'Connect file storage',
      text: 'Profile photos, documents and data exports need an S3-compatible bucket.',
      done: integrationDone('storage'),
      href: '/admin/settings/integrations',
      cta: 'Integrations',
    },
    {
      id: 'push',
      title: 'Turn on push notifications',
      text: 'Add the VAPID keys so phones and browsers can be notified.',
      done: integrationDone('push'),
      href: '/admin/settings/integrations',
      cta: 'Integrations',
    },
    {
      id: 'brand',
      title: 'Set your brand',
      text: 'Choose the app name and brand colour, then paste the generated colours into the theme.',
      done: settings?.ok ? settings.data.some((s) => s.key === 'brand.color') : false,
      href: '/admin/settings',
      cta: 'Settings',
    },
    {
      id: 'team',
      title: 'Invite a teammate',
      text: 'Add someone and give them a role, so you are not the only one who can run things.',
      done: staff?.ok ? staff.data.length > 1 : false,
      href: '/admin/users/new',
      cta: 'Add a user',
    },
  ];
  const showChecklist = isOwner && integrations?.ok && settings?.ok && staff?.ok;

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="What is happening across the app."
      />
      <OnboardingWizard
        show={Boolean(
          isOwner &&
          settings?.ok &&
          !settings.data.some((s) => s.key === ONBOARDING_SETTING) &&
          // Test sign-in (DEV_LOGIN, never on in production) skips the modal so the e2e specs and screenshots
          // aren't covered by it; open /admin?welcome=1 to see it anyway.
          (!devLoginEnabled() || welcome === '1'),
        )}
        appName={SITE.name}
      />
      {showChecklist && <GettingStarted steps={steps} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {users?.ok && (
          <TileLink href="/admin/users" label="Users">
            <StatTile
              label="Users"
              value={activeUsers}
              icon={<UsersIcon />}
              hint={archivedUsers ? `${archivedUsers} archived` : 'Active contacts'}
            />
          </TileLink>
        )}
        {users?.ok && (
          <TileLink href="/admin/users" label="New this week">
            <StatTile
              label="New this week"
              value={users.data.total > 200 && newThisWeek >= 200 ? '200+' : newThisWeek}
              hint={`Sign-ups, last ${DAYS} days`}
              chart={
                <Sparkline
                  data={signups}
                  label={`New users per day, last ${DAYS} days`}
                  series={1}
                />
              }
            />
          </TileLink>
        )}
        {errors?.ok && (
          <TileLink href="/admin/errors" label="Open errors">
            <StatTile
              label="Open errors"
              value={openErrors.length}
              icon={<BugIcon />}
              delta={
                errors24h > 0
                  ? { value: `${errors24h} in the last 24 h`, direction: 'up', good: false }
                  : { value: 'none in the last 24 h', direction: 'flat' }
              }
              hint="Distinct bugs, last 30 days"
            />
          </TileLink>
        )}
        {activity?.ok && (
          <TileLink href="/admin/activity" label="Activity">
            <StatTile
              label="Events today"
              value={perDay.at(-1) ?? 0}
              icon={<PulseIcon />}
              hint={failed24h ? `${failed24h} failed or denied in 24 h` : 'Nothing failed in 24 h'}
              chart={
                <Sparkline data={perDay} label={`Events per day, last ${DAYS} days`} series={2} />
              }
            />
          </TileLink>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {activity?.ok && events.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Activity per day</CardTitle>
              <CardDescription>
                From the latest {events.length} events (changes, sign-ins, API calls); the axis
                shows the day of the month.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart
                title="Events per day"
                data={days.map((_, i) => ({ label: dayLabels(days)[i]!, value: perDay[i]! }))}
                series={0}
              />
            </CardContent>
          </Card>
        )}
        {types.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Users by type</CardTitle>
              <CardDescription>
                <Link href="/admin/users" className="underline underline-offset-4">
                  See everyone
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DonutChart
                title="Users by type"
                centerLabel="People"
                data={types.map((t) => ({ label: t.label, value: t.contactCount }))}
              />
            </CardContent>
          </Card>
        )}
        {deliveries?.ok && (
          <Card>
            <CardHeader>
              <CardTitle>Notification deliveries</CardTitle>
              <CardDescription>
                Emails, texts and pushes by status (latest {deliveries.data.length}).{' '}
                <Link href="/admin/notifications" className="underline underline-offset-4">
                  Open the log
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {byStatus.size === 0 ? (
                <Empty
                  size="sm"
                  icon={<ChartBarIcon />}
                  title="Nothing sent yet"
                  description="Deliveries show up here once the app notifies someone."
                />
              ) : (
                <DonutChart
                  title="Deliveries by status"
                  centerLabel="Sent"
                  data={[...byStatus].map(([label, value]) => ({ label, value }))}
                />
              )}
            </CardContent>
          </Card>
        )}
        {health && (
          <Card>
            <CardHeader>
              <CardTitle>Scheduled jobs</CardTitle>
              <CardDescription>
                Each job should have run recently.{' '}
                <Link href="/admin/system" className="underline underline-offset-4">
                  System
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!health.ok ? (
                <ActionError error={health.error} what="the system health" />
              ) : (
                <ul className="grid gap-3 text-sm">
                  {crons.map((c) => (
                    <li key={c.job} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="font-medium">{c.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {c.lastOkAt
                            ? `Last OK ${formatDateTime(c.lastOkAt)}`
                            : 'Has not run here yet'}
                        </span>
                      </span>
                      {c.stale ? (
                        <Pill tone="danger" dot size="sm">
                          Stale
                        </Pill>
                      ) : c.lastOkAt ? (
                        <Pill tone="success" dot size="sm">
                          Running
                        </Pill>
                      ) : (
                        <Pill tone="neutral" dot size="sm">
                          Unknown
                        </Pill>
                      )}
                    </li>
                  ))}
                  <li className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3">
                    <span className="font-medium">Failed background jobs</span>
                    {failedJobs > 0 ? (
                      <Badge color="red">{failedJobs}</Badge>
                    ) : (
                      <Pill tone="success" dot size="sm">
                        None
                      </Pill>
                    )}
                  </li>
                  {stale > 0 && (
                    <li className="text-xs text-destructive">
                      {stale} job{stale === 1 ? ' is' : 's are'} overdue: check your cron scheduler.
                    </li>
                  )}
                </ul>
              )}
            </CardContent>
          </Card>
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
            <CardContent>
              {activity.ok ? (
                <ActivityTimeline
                  items={events.slice(0, 8).map((e) => ({
                    id: e.id,
                    summary: e.summary ?? e.action,
                    who: `${actorLabel(e)} · ${e.channel}`,
                    at: e.occurredAt.toISOString(),
                    ok: e.ok,
                  }))}
                />
              ) : (
                <ActionError error={activity.error} what="the activity" />
              )}
            </CardContent>
          </Card>
        )}
        {errors && (
          <Card>
            <CardHeader>
              <CardTitle>Open errors</CardTitle>
              <CardDescription>Bugs and outages, repeats grouped.</CardDescription>
            </CardHeader>
            <CardContent>
              {!errors.ok ? (
                <ActionError error={errors.error} what="the errors" />
              ) : openErrors.length === 0 ? (
                <Empty
                  size="sm"
                  icon={<ClockCountdownIcon />}
                  title="No open errors"
                  description="Nothing has broken in the last 30 days."
                />
              ) : (
                <ul className="grid gap-2">
                  {openErrors.slice(0, 5).map((e) => (
                    <li key={e.fingerprint}>
                      <Link
                        href={`/admin/errors/${e.ref}`}
                        className="-mx-2 flex items-start gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{e.message}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {e.ref} · {e.count}× · last {formatDateTime(e.lastSeen)}
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
      </div>
    </div>
  );
}
