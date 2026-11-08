import { callAction, getContact, listRoles, listTags } from '@app/core';
import { Avatar } from '@app/ui/components/avatar';
import { Badge } from '@app/ui/components/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/ui/components/card';
import { DetailItem, DetailList } from '@app/ui/components/detail-list';
import { RecordHeader } from '@app/ui/components/page';
import { formatDate } from '@app/ui/lib/dates';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArchiveButton } from '@/components/admin/archive-button';
import { FilterLinks } from '@/components/admin/filter-links';
import { RecordHistory } from '@/components/admin/record-history';
import { RoleEditor } from '@/components/admin/role-editor';
import { TagEditor } from '@/components/admin/tag-editor';
import { UserDetailsCard } from '@/components/admin/user-details-card';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'User' };

export default async function UserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const tab = (await searchParams).tab === 'history' ? 'history' : 'overview';
  const viewer = await requireViewer('users.read', `/admin/users/${id}`);
  const result = await callAction(getContact, { id }, viewer.actor);
  if (!result.ok) notFound();
  const c = result.data;
  const canWrite = viewer.can('users.manage');
  const canRoles = viewer.can('roles.manage');
  const [tags, roles] =
    tab === 'overview'
      ? await Promise.all([callAction(listTags, {}, viewer.actor), canRoles ? callAction(listRoles, {}, viewer.actor) : null])
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
            Added {formatDate(c.createdAt)} from {c.source} · {c.hasLogin ? 'has a login' : 'no login yet'}
          </>
        }
        actions={canWrite && <ArchiveButton id={c.id} archived={c.status === 'archived'} />}
      />
      <FilterLinks
        label="User sections"
        items={[
          { href: `/admin/users/${c.id}`, label: 'Overview', active: tab === 'overview' },
          ...(viewer.can('activity.read') ? [{ href: `/admin/users/${c.id}?tab=history`, label: 'History', active: tab === 'history' }] : []),
        ]}
      />
      {tab === 'history' ? (
        <RecordHistory viewer={viewer} subjectId={c.id} what="this user" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <UserDetailsCard contact={c} canEdit={canWrite} />
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
                  options={tags?.ok ? tags.data.map(({ slug, label, kind }) => ({ slug, label, kind })) : []}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>App access</CardTitle>
                <CardDescription>Roles unlock Admin. Everyone with a login gets My account.</CardDescription>
              </CardHeader>
              <CardContent>
                {canRoles && roles?.ok ? (
                  <RoleEditor contactId={c.id} roles={c.roles} hasLogin={c.hasLogin} options={roles.data.map(({ role, description }) => ({ role, description }))} />
                ) : (
                  <DetailList>
                    <DetailItem label="Roles">{c.roles.length ? <span className="capitalize">{c.roles.join(', ')}</span> : 'Customer access only'}</DetailItem>
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
