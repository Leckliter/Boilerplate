import { callAction, getMyAccount } from '@app/core';
import { listFiles, storageConfigured } from '@app/core/files';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/ui/components/card';
import { PageHeader } from '@app/ui/components/page';

import { AvatarEditor } from '@/components/account/avatar-editor';
import { ActionError } from '@/components/action-error';
import { ProfileCard } from '@/components/account/profile-card';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const viewer = await requireViewer(undefined, '/account/profile');
  const storageReady = storageConfigured();
  const [me, avatars] = await Promise.all([
    callAction(getMyAccount, {}, viewer.actor),
    storageReady
      ? callAction(listFiles, { purpose: 'avatar', subjectId: viewer.contactId }, viewer.actor)
      : null,
  ]);
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <PageHeader title="Profile" description="Your details." />
      <Card>
        <CardHeader>
          <CardTitle>Photo</CardTitle>
          <CardDescription>Shown beside your name. PNG, JPG or WebP, up to 5 MB.</CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarEditor
            contactId={viewer.contactId}
            name={viewer.displayName}
            src={avatars?.ok ? (avatars.data[0]?.url ?? null) : null}
            oldIds={avatars?.ok ? avatars.data.map((f) => f.id) : []}
            storageReady={storageReady}
          />
        </CardContent>
      </Card>
      {me.ok ? <ProfileCard me={me.data} /> : <ActionError error={me.error} what="your profile" />}
    </div>
  );
}
