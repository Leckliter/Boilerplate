import { callAction, listTags } from '@app/core';
import { Card, CardContent } from '@app/ui/components/card';
import { RecordHeader } from '@app/ui/components/page';
import Link from 'next/link';

import { NewUserForm } from '@/components/admin/new-user-form';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'New user' };

/** Create pages are plain forms (docs/design-system.md rule 9): the same action as the dialog on the list. */
export default async function NewUserPage() {
  const viewer = await requireViewer('users.manage', '/admin/users/new');
  const tags = await callAction(listTags, {}, viewer.actor);
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <RecordHeader back={<Link href="/admin/users">← Users</Link>} title="New user" />
      <Card>
        <CardContent>
          <NewUserForm tags={tags.ok ? tags.data.filter((t) => t.kind === 'type').map((t) => ({ slug: t.slug, label: t.label })) : []} />
        </CardContent>
      </Card>
    </div>
  );
}
