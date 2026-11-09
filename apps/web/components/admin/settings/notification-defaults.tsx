import { callAction } from '@app/core';
import { getPreferences } from '@app/core/notifications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/ui/components/card';
import { CheckIcon, LockIcon, MinusIcon } from '@app/ui/components/icons';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@app/ui/components/table';
import Link from 'next/link';

import { ActionError } from '@/components/action-error';
import { SendTestButton } from '@/components/notifications/send-test-button';
import type { SignedInViewer } from '@/lib/viewer';

const CHANNELS = [
  ['email', 'Email'],
  ['sms', 'Text'],
  ['push', 'Push'],
] as const;

/**
 * Settings → Notifications: every kind of message the app can send and how it reaches people by default.
 * Defaults live in code (packages/core/src/notifications/*-types.ts), and people change their own copy in
 * Account → Notifications, so this is a read-only reference, shown through the signed-in person's own
 * settings (which start from the defaults). Required messages (receipts, security) are locked on.
 */
export async function NotificationDefaults({ viewer }: { viewer: SignedInViewer }) {
  const res = await callAction(getPreferences, {}, viewer.actor);
  if (!res.ok) return <ActionError error={res.error} what="the notification types" />;
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Message types</CardTitle>
          <CardDescription>
            What the app can tell people and on which channels. The in-app inbox always gets
            everything; texts only go to people who agreed to them. To change a default, edit its
            type in <code className="text-xs">packages/core/src/notifications</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Message</TableHead>
                {CHANNELS.map(([, label]) => (
                  <TableHead key={label} className="text-center">
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {res.data.types.map((t) => (
                <TableRow key={t.key}>
                  <TableCell className="max-w-sm">
                    <span className="font-medium">{t.label}</span>
                    <span className="block text-xs text-muted-foreground">{t.description}</span>
                  </TableCell>
                  {CHANNELS.map(([c, label]) => {
                    const ch = t.channels[c];
                    return (
                      <TableCell key={c} className="text-center">
                        {ch.enabled ? (
                          <CheckIcon
                            className="mx-auto size-4 text-success"
                            aria-label={`${label}: on`}
                          />
                        ) : (
                          <MinusIcon
                            className="mx-auto size-4 text-muted-foreground"
                            aria-label={`${label}: off`}
                          />
                        )}
                        {ch.locked && (
                          <LockIcon
                            className="mx-auto mt-0.5 size-3 text-muted-foreground"
                            aria-label="Always on"
                          />
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Check delivery</CardTitle>
          <CardDescription>
            Send yourself a test on every channel you can receive, then look it up in the{' '}
            <Link href="/admin/notifications" className="underline underline-offset-4">
              delivery log
            </Link>
            . Outside production, email and texts only go to the test recipients.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SendTestButton />
        </CardContent>
      </Card>
    </div>
  );
}
