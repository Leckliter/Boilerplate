import { callAction, getMyAccount } from '@app/core';
import { PageHeader } from '@app/ui/components/page';

import { ActionError } from '@/components/action-error';
import { ProfileCard } from '@/components/account/profile-card';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const viewer = await requireViewer(undefined, '/account/profile');
  const me = await callAction(getMyAccount, {}, viewer.actor);
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <PageHeader title="Profile" description="Your details." />
      {me.ok ? <ProfileCard me={me.data} /> : <ActionError error={me.error} what="your profile" />}
    </div>
  );
}
