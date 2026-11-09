import { callAction, getMyAccount } from '@app/core';
import { Badge } from '@app/ui/components/badge';
import { Callout } from '@app/ui/components/callout';
import { Card, CardDescription, CardHeader, CardTitle } from '@app/ui/components/card';
import { PageHeader } from '@app/ui/components/page';
import {
  ArrowRightIcon,
  BellIcon,
  LockIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  UserIcon,
} from '@app/ui/components/icons';
import { formatDate } from '@app/ui/lib/dates';
import Link from 'next/link';

import { ActionError } from '@/components/action-error';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Overview' };

const LINKS = [
  { href: '/account/profile', title: 'Profile', text: 'Your name and phone.', icon: UserIcon },
  {
    href: '/account/security',
    title: 'Security',
    text: 'How you sign in, and signing out.',
    icon: LockIcon,
  },
  {
    href: '/account/preferences',
    title: 'Preferences',
    text: 'Theme, language and time zone.',
    icon: SlidersHorizontalIcon,
  },
  {
    href: '/account/privacy',
    title: 'Privacy & data',
    text: 'Download your data or delete your account.',
    icon: ShieldCheckIcon,
  },
  {
    href: '/account/notifications',
    title: 'Notifications',
    text: 'Inbox, push, text and email.',
    icon: BellIcon,
  },
];

/** The customer portal home. Add your own cards (orders, invoices, projects …) here. */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const viewer = await requireViewer(undefined, '/account');
  const { denied } = await searchParams;
  const me = await callAction(getMyAccount, {}, viewer.actor);
  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Hello, ${viewer.displayName.split(' ')[0]}`}
        description="Manage your details and how we reach you."
      />
      {denied && <Callout tone="warning">You don’t have access to that page.</Callout>}
      {!me.ok ? (
        <ActionError error={me.error} what="your account" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {me.data.displayName}
              {me.data.roles.map((r) => (
                <Badge key={r} color="green" className="capitalize">
                  {r}
                </Badge>
              ))}
            </CardTitle>
            <CardDescription>
              {me.data.email} · member since {formatDate(me.data.createdAt)}
            </CardDescription>
          </CardHeader>
        </Card>
      )}
      {viewer.can('admin.access') && (
        <Callout tone="info" className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <ShieldCheckIcon /> You have access to Admin.
          </span>
          <Link href="/admin" className="font-medium underline underline-offset-4">
            Open Admin
          </Link>
        </Callout>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="h-full p-4 transition-colors group-hover:bg-tint">
              <l.icon className="size-5 text-muted-foreground" />
              <p className="mt-3 flex items-center justify-between gap-2 font-semibold">
                {l.title} <ArrowRightIcon className="size-4 text-muted-foreground" />
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{l.text}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
