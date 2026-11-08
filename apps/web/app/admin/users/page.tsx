import { callAction, listContacts, listTags } from '@app/core';
import { Avatar } from '@app/ui/components/avatar';
import { buttonVariants } from '@app/ui/components/button';
import { Card } from '@app/ui/components/card';
import { Empty } from '@app/ui/components/empty';
import { KeyIcon, PlusIcon, UsersIcon } from '@app/ui/components/icons';
import { rowLink, rowLinkRow } from '@app/ui/components/link';
import { PageHeader } from '@app/ui/components/page';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@app/ui/components/table';
import { cn } from '@app/ui/lib/utils';
import Link from 'next/link';

import { ActionError } from '@/components/action-error';
import { FilterLinks } from '@/components/admin/filter-links';
import { NewUserDialog } from '@/components/admin/new-user-dialog';
import { TagBadges } from '@/components/admin/tag-badges';
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
      { tag, search: q, includeArchived: archived === '1', limit: PAGE_SIZE, offset: (pageNum - 1) * PAGE_SIZE },
      viewer.actor,
    ),
    callAction(listTags, {}, viewer.actor),
  ]);
  const types = tags.ok ? tags.data.filter((t) => t.kind === 'type') : [];
  const contacts = result.ok ? result.data.contacts : [];
  const total = result.ok ? result.data.total : 0;
  const href = (change: Record<string, string | undefined>) => {
    const next = new URLSearchParams(
      Object.entries({ tag, q, archived, ...change }).filter((e): e is [string, string] => Boolean(e[1])),
    );
    return `/admin/users${next.size ? `?${next}` : ''}`;
  };
  const canWrite = viewer.can('users.manage');

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone the business deals with, in one list: customers, leads, staff, vendors."
        actions={canWrite && <NewUserDialog tags={types.map((t) => ({ slug: t.slug, label: t.label }))} />}
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
        filters={
          <FilterLinks
            label="Filter by type"
            items={[
              { href: href({ tag: undefined, page: undefined }), label: 'Everyone', active: !tag },
              ...types.map((t) => ({ href: href({ tag: t.slug, page: undefined }), label: t.label, count: t.contactCount, active: tag === t.slug })),
              { href: href({ archived: archived === '1' ? undefined : '1', page: undefined }), label: 'Archived', active: archived === '1' },
            ]}
          />
        }
      />
      <Card>
        {!result.ok ? (
          <div className="p-5">
            <ActionError error={result.error} what="the users" />
          </div>
        ) : contacts.length === 0 ? (
          <Empty icon={<UsersIcon />} title={q ? 'No matches' : 'No users yet'} description={q ? 'Try a different search.' : 'People you add, or who sign up, show up here.'} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Phone</TableHead>
                <TableHead>Tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c) => (
                <TableRow key={c.id} className={rowLinkRow}>
                  <TableCell>
                    <Link href={`/admin/users/${c.id}`} className={cn('flex items-center gap-3', rowLink)}>
                      <Avatar name={c.displayName} />
                      <span className="grid min-w-0">
                        <span className="flex min-w-0 items-center gap-1.5 font-medium">
                          <span className="truncate">{c.displayName}</span>
                          {c.hasLogin && <KeyIcon className="size-3 shrink-0 text-muted-foreground" aria-label="Has a login" />}
                        </span>
                        <span className="truncate text-xs text-muted-foreground md:hidden">{c.email}</span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden [overflow-wrap:anywhere] text-muted-foreground md:table-cell">{c.email ?? '—'}</TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums lg:table-cell">{c.phone ?? '—'}</TableCell>
                  <TableCell>
                    <TagBadges tags={c.tags} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      {total > PAGE_SIZE && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {(pageNum - 1) * PAGE_SIZE + 1}–{Math.min(pageNum * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            {pageNum > 1 && (
              <Link className={buttonVariants({ size: 'sm' })} href={href({ page: String(pageNum - 1) })}>
                Previous
              </Link>
            )}
            {pageNum * PAGE_SIZE < total && (
              <Link className={buttonVariants({ size: 'sm' })} href={href({ page: String(pageNum + 1) })}>
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
