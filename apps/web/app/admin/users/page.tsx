import { callAction, listContacts, listTags } from '@app/core';
import { buttonVariants } from '@app/ui/components/button';
import { Card } from '@app/ui/components/card';
import { PlusIcon } from '@app/ui/components/icons';
import { PageHeader } from '@app/ui/components/page';
import Link from 'next/link';

import { ActionError } from '@/components/action-error';
import { FilterLinks } from '@/components/admin/filter-links';
import { NewUserDialog } from '@/components/admin/new-user-dialog';
import { ExportCsvButton } from '@/components/admin/users/export-button';
import { ImportDialog } from '@/components/admin/users/import-dialog';
import { UsersTable } from '@/components/admin/users/users-table';
import { UrlSearch } from '@/components/admin/url-search';
import { MobilePrimaryAction, fabClass } from '@/components/layout/mobile-dock';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Users' };

const PAGE_SIZE = 25;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; q?: string; page?: string; archived?: string }>;
}) {
  const viewer = await requireViewer('users.read', '/admin/users');
  const { tag, q, page, archived } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const [result, tags] = await Promise.all([
    callAction(
      listContacts,
      {
        tag,
        search: q,
        includeArchived: archived === '1',
        limit: PAGE_SIZE,
        offset: (pageNum - 1) * PAGE_SIZE,
      },
      viewer.actor,
    ),
    callAction(listTags, {}, viewer.actor),
  ]);
  const types = tags.ok ? tags.data.filter((t) => t.kind === 'type') : [];
  const contacts = result.ok ? result.data.contacts : [];
  const total = result.ok ? result.data.total : 0;
  const href = (change: Record<string, string | undefined>) => {
    const next = new URLSearchParams(
      Object.entries({ tag, q, archived, ...change }).filter((e): e is [string, string] =>
        Boolean(e[1]),
      ),
    );
    return `/admin/users${next.size ? `?${next}` : ''}`;
  };
  const canWrite = viewer.can('users.manage');
  const tagOptions = tags.ok ? tags.data.map((t) => ({ slug: t.slug, label: t.label })) : [];

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone the business deals with, in one list: customers, leads, staff, vendors."
        actions={
          canWrite && <NewUserDialog tags={types.map((t) => ({ slug: t.slug, label: t.label }))} />
        }
      />
      {canWrite && (
        <MobilePrimaryAction>
          <Link href="/admin/users/new" aria-label="New user" className={fabClass}>
            <PlusIcon />
          </Link>
        </MobilePrimaryAction>
      )}
      <UrlSearch
        placeholder="Search name, email, phone, company…"
        label="Search users"
        actions={
          <>
            {canWrite && <ImportDialog tags={tagOptions} />}
            {viewer.can('data.export') && (
              <ExportCsvButton
                action="contacts.exportCsv"
                input={{ tag, search: q, includeArchived: archived === '1' }}
              />
            )}
          </>
        }
        filters={
          <FilterLinks
            label="Filter by type"
            items={[
              { href: href({ tag: undefined, page: undefined }), label: 'Everyone', active: !tag },
              ...types.map((t) => ({
                href: href({ tag: t.slug, page: undefined }),
                label: t.label,
                count: t.contactCount,
                active: tag === t.slug,
              })),
              {
                href: href({ archived: archived === '1' ? undefined : '1', page: undefined }),
                label: 'Archived',
                active: archived === '1',
              },
            ]}
          />
        }
      />
      {!result.ok ? (
        <Card>
          <div className="p-5">
            <ActionError error={result.error} what="the users" />
          </div>
        </Card>
      ) : (
        <UsersTable
          rows={contacts.map((c) => ({
            id: c.id,
            displayName: c.displayName,
            email: c.email,
            phone: c.phone,
            hasLogin: c.hasLogin,
            status: c.status,
            createdAt: new Date(c.createdAt).toISOString(),
            tags: c.tags.map(({ slug, label, color }) => ({ slug, label, color })),
          }))}
          tags={tagOptions}
          canWrite={canWrite}
          emptyIsFiltered={Boolean(q || tag || archived)}
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
