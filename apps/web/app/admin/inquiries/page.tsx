import { callAction } from '@app/core';
import { listInquiries } from '@app/core/inquiries';
import { buttonVariants } from '@app/ui/components/button';
import { PageHeader } from '@app/ui/components/page';
import Link from 'next/link';

import { ActionError } from '@/components/action-error';
import { FilterLinks } from '@/components/admin/filter-links';
import { InquiriesTable } from '@/components/admin/inquiries/inquiries-table';
import { UrlSearch } from '@/components/admin/url-search';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Inquiries' };

const PAGE_SIZE = 25;
const STATUSES = ['new', 'in_progress', 'resolved', 'spam', 'archived'] as const;
const LABELS = {
  new: 'New',
  in_progress: 'In progress',
  resolved: 'Resolved',
  spam: 'Spam',
  archived: 'Archived',
} as const;

/** Messages from the website contact form (`inquiries.*`). The status tabs live in the URL, with a count each. */
export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const viewer = await requireViewer('inquiries.manage', '/admin/inquiries');
  const { status: rawStatus, q, page } = await searchParams;
  const status = STATUSES.find((s) => s === rawStatus);
  const pageNum = Math.max(1, Number(page) || 1);
  const result = await callAction(
    listInquiries,
    { status, q, limit: PAGE_SIZE, offset: (pageNum - 1) * PAGE_SIZE },
    viewer.actor,
  );
  const href = (change: Record<string, string | undefined>) => {
    const next = new URLSearchParams(
      Object.entries({ status, q, ...change }).filter((e): e is [string, string] => Boolean(e[1])),
    );
    return `/admin/inquiries${next.size ? `?${next}` : ''}`;
  };
  const counts = result.ok ? result.data.counts : null;
  const total = result.ok ? result.data.total : 0;

  return (
    <>
      <PageHeader
        title="Inquiries"
        description="Messages from the website contact form. Each sender is also a contact."
      />
      <UrlSearch placeholder="Search name, email or message…" label="Search inquiries" />
      <FilterLinks
        className="mb-4"
        label="Inquiry status"
        items={[
          {
            href: href({ status: undefined, page: undefined }),
            label: 'Open',
            active: !status,
            count: counts ? counts.new + counts.in_progress + counts.resolved : undefined,
          },
          ...STATUSES.map((s) => ({
            href: href({ status: s, page: undefined }),
            label: LABELS[s],
            active: status === s,
            count: counts?.[s],
          })),
        ]}
      />
      {!result.ok ? (
        <ActionError error={result.error} what="the inquiries" />
      ) : (
        <InquiriesTable
          filtered={Boolean(status || q)}
          rows={result.data.inquiries.map((i) => ({
            id: i.id,
            name: i.name,
            email: i.email,
            subject: i.subject,
            message: i.message,
            status: i.status,
            createdAt: new Date(i.createdAt).toISOString(),
          }))}
        />
      )}
      {total > PAGE_SIZE && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {(pageNum - 1) * PAGE_SIZE + 1}–{Math.min(pageNum * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            {pageNum > 1 && (
              <Link
                className={buttonVariants({ size: 'sm' })}
                href={href({ page: String(pageNum - 1) })}
              >
                Previous
              </Link>
            )}
            {pageNum * PAGE_SIZE < total && (
              <Link
                className={buttonVariants({ size: 'sm' })}
                href={href({ page: String(pageNum + 1) })}
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
