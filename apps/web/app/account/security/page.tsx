import { Button } from '@app/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/ui/components/card';
import { DetailItem, DetailList } from '@app/ui/components/detail-list';
import { PageHeader } from '@app/ui/components/page';
import { SignOutIcon } from '@app/ui/components/icons';

import { signOut } from '@/lib/auth/actions';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Security' };

export default async function SecurityPage() {
  const viewer = await requireViewer(undefined, '/account/security');
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <PageHeader title="Security" description="How you sign in." />
      <Card>
        <CardHeader>
          <CardTitle>Sign-in</CardTitle>
          <CardDescription>There is no password to remember or leak: we email you a one-time code each time.</CardDescription>
        </CardHeader>
        <CardContent>
          <DetailList>
            <DetailItem label="Signed in as" copy={viewer.email}>
              {viewer.email}
            </DetailItem>
            <DetailItem label="Method">Emailed one-time code</DetailItem>
          </DetailList>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Sign out</CardTitle>
          <CardDescription>Ends the session in this browser.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signOut}>
            <Button type="submit" icon={<SignOutIcon />}>
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
