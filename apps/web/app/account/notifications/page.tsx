import { getPreferences, listNotifications } from '@app/core/notifications';
import { callAction } from '@app/core';
import { BellIcon } from '@app/ui/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/ui/components/card';
import { Empty } from '@app/ui/components/empty';
import { PageHeader } from '@app/ui/components/page';

import { ActionError } from '@/components/action-error';
import { FilterLinks } from '@/components/admin/filter-links';
import { InboxList } from '@/components/notifications/inbox-list';
import { PreferenceGrid } from '@/components/notifications/preference-grid';
import { SendTestButton } from '@/components/notifications/send-test-button';
import { SmsConsentCard } from '@/components/notifications/sms-consent-card';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Notifications' };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const viewer = await requireViewer(undefined, '/account/notifications');
  const tab = (await searchParams).tab === 'settings' ? 'settings' : 'inbox';
  const tabs = [
    { href: '/account/notifications', label: 'Inbox', active: tab === 'inbox' },
    { href: '/account/notifications?tab=settings', label: 'Settings', active: tab === 'settings' },
  ];

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <PageHeader
        title="Notifications"
        description="What we tell you, and how. Receipts and security messages always come by email."
        actions={tab === 'settings' ? <SendTestButton /> : undefined}
      />
      <FilterLinks label="Notifications" items={tabs} />
      {tab === 'inbox' ? <Inbox actor={viewer.actor} /> : <Settings actor={viewer.actor} />}
    </div>
  );
}

type Actor = Awaited<ReturnType<typeof requireViewer>>['actor'];

async function Inbox({ actor }: { actor: Actor }) {
  const res = await callAction(listNotifications, { limit: 50 }, actor);
  if (!res.ok) return <ActionError error={res.error} what="your notifications" />;
  if (res.data.items.length === 0) {
    return (
      <Card>
        <Empty
          icon={<BellIcon />}
          title="Nothing new"
          description="When something happens that you should know about, it shows up here."
        />
      </Card>
    );
  }
  return <InboxList items={res.data.items} />;
}

async function Settings({ actor }: { actor: Actor }) {
  const res = await callAction(getPreferences, {}, actor);
  if (!res.ok) return <ActionError error={res.error} what="your settings" />;
  const p = res.data;
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Text messages</CardTitle>
          <CardDescription>
            We only text you if you say yes here. Reply STOP to any text to stop.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SmsConsentCard
            phone={p.sms.phone}
            consentAt={p.sms.consentAt}
            stopped={p.sms.stopped}
            consentText={p.smsConsentText}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>What you get</CardTitle>
          <CardDescription>
            Email goes to {p.email.address ?? 'no address yet'}
            {p.email.suppressed ? ` (paused: ${p.email.suppressed})` : ''}. The inbox always gets
            everything.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PreferenceGrid types={p.types} />
        </CardContent>
      </Card>
    </>
  );
}
