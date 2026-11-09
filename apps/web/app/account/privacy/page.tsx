import { callAction } from '@app/core';
import { deletionStatus } from '@app/core/account-data';
import { listFiles, storageConfigured } from '@app/core/files';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/ui/components/card';
import { PageHeader } from '@app/ui/components/page';

import { ActionError } from '@/components/action-error';
import { DataExport } from '@/components/account/data-export';
import { DeleteAccount } from '@/components/account/delete-account';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Privacy & data' };

/**
 * Your data, in your hands: a copy of everything we hold about you (`account.exportData`), and deleting
 * your account (`account.requestDeletion`, with a grace period and a way back).
 */
export default async function PrivacyPage() {
  const viewer = await requireViewer(undefined, '/account/privacy');
  const storageReady = storageConfigured();
  const [status, exports] = await Promise.all([
    callAction(deletionStatus, {}, viewer.actor),
    storageReady
      ? callAction(listFiles, { purpose: 'data_export', subjectId: viewer.contactId }, viewer.actor)
      : null,
  ]);
  const latest = exports?.ok ? exports.data[0] : undefined;

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <PageHeader title="Privacy & data" description="See what we hold about you, or delete it." />
      <Card>
        <CardHeader>
          <CardTitle>Download my data</CardTitle>
          <CardDescription>
            One file with your details, settings, notifications, devices, files list and the
            activity about you. We notify you when it’s ready.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataExport
            contactId={viewer.contactId}
            storageReady={storageReady}
            initial={
              latest
                ? {
                    id: latest.id,
                    url: latest.url,
                    filename: latest.filename,
                    createdAt: new Date(latest.createdAt).toISOString(),
                  }
                : null
            }
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Delete my account</CardTitle>
          <CardDescription>
            Erases your personal data and signs you out everywhere. Records the business must keep
            stay, with your name removed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status.ok ? (
            <DeleteAccount
              email={viewer.email}
              graceDays={status.data.graceDays}
              pending={
                status.data.pending
                  ? { scheduledFor: new Date(status.data.pending.scheduledFor).toISOString() }
                  : null
              }
            />
          ) : (
            <ActionError error={status.error} what="your deletion status" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
