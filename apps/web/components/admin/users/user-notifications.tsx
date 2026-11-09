import type { ContactView } from '@app/core';
import type { preferencesFor } from '@app/core/notifications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/ui/components/card';
import { Callout } from '@app/ui/components/callout';
import { DetailItem, DetailList } from '@app/ui/components/detail-list';
import { Empty } from '@app/ui/components/empty';
import { CheckIcon, EnvelopeIcon, MinusIcon } from '@app/ui/components/icons';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@app/ui/components/table';
import { getServerDates } from '@/lib/dates-server';
import Link from 'next/link';

import { DeliveryBadge } from '@/components/notifications/delivery-badge';

export type DeliveryRow = {
  id: string;
  channel: string;
  status: string;
  title: string;
  type: string;
  createdAt: Date;
  lastError: string | null;
};

type Preferences = Awaited<ReturnType<typeof preferencesFor.run>>;

const CHANNEL: Record<string, string> = { email: 'Email', sms: 'Text', push: 'Push' };

/**
 * The Notifications tab of a user, read-only: how we may reach them (email, texting consent with the
 * exact wording they agreed to) and what we have sent them lately. Their per-message switches are
 * private to them (Account → Notifications); staff see the outcome here, never change it for them.
 */
export async function UserNotifications({
  contact: c,
  deliveries,
  preferences,
  canSeeLog,
}: {
  contact: ContactView;
  deliveries: DeliveryRow[] | null;
  /** notifications.preferencesFor: their per-message switches as they stand now (null: not allowed to see). */
  preferences: Preferences | null;
  canSeeLog: boolean;
}) {
  const { formatDateTime } = await getServerDates();
  const newsletter = c.tags.some((t) => t.slug === 'newsletter');
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>How we can reach them</CardTitle>
          <CardDescription>
            Read-only. They change these in Account → Notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DetailList>
            <DetailItem label="Email">{c.email ?? 'No email address'}</DetailItem>
            <DetailItem label="Newsletter">
              {newsletter ? 'Subscribed' : 'Not subscribed'}
            </DetailItem>
            <DetailItem label="Texts">
              {c.smsConsentAt
                ? `Agreed on ${formatDateTime(c.smsConsentAt)}${c.smsConsentSource ? ` (${c.smsConsentSource})` : ''}`
                : 'No consent recorded: we never text this person.'}
            </DetailItem>
            {c.smsConsentAt && c.smsConsentText && (
              <DetailItem label="They agreed to">
                <span className="text-muted-foreground">“{c.smsConsentText}”</span>
              </DetailItem>
            )}
          </DetailList>
        </CardContent>
      </Card>
      {preferences && (
        <Card>
          <CardHeader>
            <CardTitle>What they get</CardTitle>
            <CardDescription>
              Each message type and the channels it reaches them on, with their own choices applied.
              Read-only: only they can change it.
              {preferences.email.suppressed &&
                ` Email to them is paused (${preferences.email.suppressed}).`}
              {preferences.sms.stopped && ' They replied STOP to texts.'}
              {preferences.devices.length > 0 &&
                ` ${preferences.devices.length} device${preferences.devices.length === 1 ? '' : 's'} receive push.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Message</TableHead>
                  {Object.values(CHANNEL).map((label) => (
                    <TableHead key={label} className="text-center">
                      {label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preferences.types.map((t) => (
                  <TableRow key={t.key}>
                    <TableCell className="max-w-xs">
                      <span className="block truncate font-medium">{t.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {t.description}
                      </span>
                    </TableCell>
                    {Object.entries(CHANNEL).map(([c, label]) => {
                      const ch = t.channels[c as keyof typeof t.channels];
                      return (
                        <TableCell key={c} className="text-center">
                          {ch.enabled ? (
                            <CheckIcon
                              className="mx-auto size-4 text-success"
                              role="img"
                              aria-label={`${label}: on`}
                            />
                          ) : (
                            <MinusIcon
                              className="mx-auto size-4 text-muted-foreground"
                              role="img"
                              aria-label={`${label}: off`}
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
      )}
      <Card>
        <CardHeader>
          <CardTitle>Recently sent</CardTitle>
          <CardDescription>
            Emails, texts and pushes to this person.{' '}
            {canSeeLog && (
              <Link href="/admin/notifications" className="underline underline-offset-4">
                Open the full log
              </Link>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className={deliveries?.length ? 'p-0' : undefined}>
          {deliveries === null ? (
            <Callout tone="info">Your role can’t see the delivery log.</Callout>
          ) : deliveries.length === 0 ? (
            <Empty
              size="sm"
              icon={<EnvelopeIcon />}
              title="Nothing sent yet"
              description="When the app notifies this person, each email, text or push is listed here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Message</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="max-w-xs">
                      <span className="block truncate font-medium">{d.title}</span>
                      <code className="text-xs text-muted-foreground">{d.type}</code>
                    </TableCell>
                    <TableCell>{CHANNEL[d.channel] ?? d.channel}</TableCell>
                    <TableCell>
                      <DeliveryBadge status={d.status} />
                      {d.lastError && (
                        <span className="block max-w-48 truncate text-xs text-muted-foreground">
                          {d.lastError}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {formatDateTime(d.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
