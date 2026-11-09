import { callAction } from '@app/core';
import { getInquiry } from '@app/core/inquiries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/ui/components/card';
import { DetailItem, DetailLink, DetailList } from '@app/ui/components/detail-list';
import { RecordHeader } from '@app/ui/components/page';
import { formatDateTime } from '@app/ui/lib/dates';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ActionError } from '@/components/action-error';
import { InquiryForm } from '@/components/admin/inquiries/inquiry-form';
import { InquiryStatusBadge } from '@/components/admin/status-badges';
import { TagBadges } from '@/components/admin/tag-badges';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Inquiry' };

export default async function InquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer('inquiries.manage', `/admin/inquiries/${id}`);
  const result = await callAction(getInquiry, { id }, viewer.actor);
  if (!result.ok) {
    if (result.error.code === 'not_found' || result.error.code === 'invalid_input') notFound();
    return <ActionError error={result.error} what="this inquiry" />;
  }
  const i = result.data;
  return (
    <div className="grid gap-6">
      <RecordHeader
        back={<Link href="/admin/inquiries">← Inquiries</Link>}
        title={i.subject || `Message from ${i.name}`}
        badges={<InquiryStatusBadge status={i.status} />}
        meta={
          <>
            {formatDateTime(i.createdAt)} · from the {i.source} form
            {i.handledByName && ` · handled by ${i.handledByName}`}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Message</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base [overflow-wrap:anywhere] whitespace-pre-wrap">{i.message}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Handle it</CardTitle>
              <CardDescription>Set where it stands and leave a note for the team.</CardDescription>
            </CardHeader>
            <CardContent>
              <InquiryForm id={i.id} status={i.status} note={i.staffNote} />
            </CardContent>
          </Card>
        </div>
        <Card className="content-start">
          <CardHeader>
            <CardTitle>Sender</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList>
              <DetailItem label="Name">{i.name}</DetailItem>
              <DetailItem label="Email" copy={i.email}>
                <DetailLink href={`mailto:${i.email}`}>{i.email}</DetailLink>
              </DetailItem>
              <DetailItem label="Phone">
                {i.phone && <DetailLink href={`tel:${i.phone}`}>{i.phone}</DetailLink>}
              </DetailItem>
              <DetailItem label="Contact">
                {i.contact ? (
                  <span className="grid gap-1">
                    <Link
                      href={`/admin/users/${i.contact.id}`}
                      className="font-medium underline underline-offset-4"
                    >
                      {i.contact.displayName}
                    </Link>
                    <TagBadges tags={i.contact.tags} />
                  </span>
                ) : null}
              </DetailItem>
            </DetailList>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
