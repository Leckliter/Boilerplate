import { callAction, getContact, listRoles, listTags } from '@app/core';
import { listFiles, storageConfigured } from '@app/core/files';
import { listDeliveries, preferencesFor } from '@app/core/notifications';
import { Avatar } from '@app/ui/components/avatar';
import { Callout } from '@app/ui/components/callout';
import { Badge } from '@app/ui/components/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/ui/components/card';
import { DetailItem, DetailList } from '@app/ui/components/detail-list';
import { RecordHeader } from '@app/ui/components/page';
import { getServerDates } from '@/lib/dates-server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AvatarEditor } from '@/components/account/avatar-editor';
import { ActionError } from '@/components/action-error';
import { ArchiveButton } from '@/components/admin/archive-button';
import { FilterLinks } from '@/components/admin/filter-links';
import { RecordHistory } from '@/components/admin/record-history';
import { RoleEditor } from '@/components/admin/role-editor';
import { TagEditor } from '@/components/admin/tag-editor';
import { UserDetailsCard } from '@/components/admin/user-details-card';
import { UserFiles } from '@/components/admin/users/user-files';
import { UserNotifications } from '@/components/admin/users/user-notifications';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'User' };

export default async function UserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { formatDate } = await getServerDates();
  const { id } = await params;
  const raw = (await searchParams).tab;
  const tab = (['history', 'files', 'notifications'] as const).find((t) => t === raw) ?? 'overview';
  const viewer = await requireViewer('users.read', `/admin/users/${id}`);
  const result = await callAction(getContact, { id }, viewer.actor);
  if (!result.ok) notFound();
  const c = result.data;
  const canWrite = viewer.can('users.manage');
  const canRoles = viewer.can('roles.manage');
  const storageReady = storageConfigured();
  const [tags, roles, avatars] =
    tab === 'overview'
      ? await Promise.all([
          callAction(listTags, {}, viewer.actor),
          canRoles ? callAction(listRoles, {}, viewer.actor) : null,
          storageReady
            ? callAction(listFiles, { purpose: 'avatar', subjectId: c.id }, viewer.actor)
            : null,
        ])
      : [null, null, null];
  const documents =
    tab === 'files' && storageReady
      ? await callAction(listFiles, { purpose: 'contact_document', subjectId: c.id }, viewer.actor)
      : null;
  const [deliveries, preferences] =
    tab === 'notifications' && viewer.can('notifications.manage')
      ? await Promise.all([
          callAction(listDeliveries, { contactId: c.id, limit: 20 }, viewer.actor),
          callAction(preferencesFor, { contactId: c.id }, viewer.actor),
        ])
      : [null, null];

  return (
    <div className="grid gap-6">
      <RecordHeader
        back={<Link href="/admin/users">← Users</Link>}
        leading={<Avatar name={c.displayName} className="size-12 text-base" />}
        title={c.displayName}
        badges={c.status === 'archived' ? <Badge color="outline">Archived</Badge> : undefined}
        meta={
          <>
            Added {formatDate(c.createdAt)} from {c.source} ·{' '}
            {c.hasLogin ? 'has a login' : 'no login yet'}
          </>
        }
        actions={canWrite && <ArchiveButton id={c.id} archived={c.status === 'archived'} />}
      />
      <FilterLinks
        label="User sections"
        items={[
          { href: `/admin/users/${c.id}`, label: 'Overview', active: tab === 'overview' },
          { href: `/admin/users/${c.id}?tab=files`, label: 'Files', active: tab === 'files' },
          {
            href: `/admin/users/${c.id}?tab=notifications`,
            label: 'Notifications',
            active: tab === 'notifications',
          },
          ...(viewer.can('activity.read')
            ? [
                {
                  href: `/admin/users/${c.id}?tab=history`,
                  label: 'History',
                  active: tab === 'history',
                },
              ]
            : []),
        ]}
      />
      {tab === 'history' ? (
        <RecordHistory viewer={viewer} subjectId={c.id} what="this user" />
      ) : tab === 'files' ? (
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>
              Private paperwork for this person: only staff with access to users can see it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!storageReady ? (
              <Callout tone="warning">
                <span>
                  File storage isn’t set up here yet. Add the S3 variables (see{' '}
                  <Link
                    href="/admin/settings/integrations"
                    className="underline underline-offset-4"
                  >
                    Integrations
                  </Link>
                  ).
                </span>
              </Callout>
            ) : documents?.ok ? (
              <UserFiles
                contactId={c.id}
                canWrite={canWrite}
                files={documents.data.map((f) => ({
                  ...f,
                  createdAt: new Date(f.createdAt).toISOString(),
                }))}
              />
            ) : (
              documents && <ActionError error={documents.error} what="the documents" />
            )}
          </CardContent>
        </Card>
      ) : tab === 'notifications' ? (
        <UserNotifications
          contact={c}
          canSeeLog={viewer.can('notifications.manage')}
          deliveries={deliveries?.ok ? deliveries.data : null}
          preferences={preferences?.ok ? preferences.data : null}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid content-start gap-6">
            <UserDetailsCard contact={c} canEdit={canWrite} />
            <Card>
              <CardHeader>
                <CardTitle>Photo</CardTitle>
                <CardDescription>Shown beside their name in the app.</CardDescription>
              </CardHeader>
              <CardContent>
                <AvatarEditor
                  contactId={c.id}
                  name={c.displayName}
                  src={avatars?.ok ? (avatars.data[0]?.url ?? null) : null}
                  oldIds={avatars?.ok ? avatars.data.map((f) => f.id) : []}
                  storageReady={storageReady && canWrite}
                />
              </CardContent>
            </Card>
          </div>
          <div className="grid content-start gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
                <CardDescription>What this person is. Tags never grant access.</CardDescription>
              </CardHeader>
              <CardContent>
                <TagEditor
                  contactId={c.id}
                  tags={c.tags}
                  canEdit={canWrite}
                  options={
                    tags?.ok
                      ? tags.data.map(({ slug, label, kind }) => ({ slug, label, kind }))
                      : []
                  }
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>App access</CardTitle>
                <CardDescription>
                  Roles unlock Admin. Everyone with a login gets My account.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {canRoles && roles?.ok ? (
                  <RoleEditor
                    contactId={c.id}
                    roles={c.roles}
                    hasLogin={c.hasLogin}
                    options={roles.data.map(({ role, description }) => ({ role, description }))}
                  />
                ) : (
                  <DetailList>
                    <DetailItem label="Roles">
                      {c.roles.length ? (
                        <span className="capitalize">{c.roles.join(', ')}</span>
                      ) : (
                        'Customer access only'
                      )}
                    </DetailItem>
                  </DetailList>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
