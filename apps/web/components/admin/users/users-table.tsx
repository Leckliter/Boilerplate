'use client';

import { useTableLabels } from '@/lib/ui-labels';
import { confirm } from '@app/ui/components/alert-dialog';
import { Avatar } from '@app/ui/components/avatar';
import { Badge, tagColor } from '@app/ui/components/badge';
import { Button } from '@app/ui/components/button';
import { type DataTableColumn, DataTable, type SortState } from '@app/ui/components/data-table';
import { Empty } from '@app/ui/components/empty';
import { ArchiveIcon, KeyIcon, UsersIcon } from '@app/ui/components/icons';
import { useDates } from '@app/ui/components/ui-context';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useAction } from '@/lib/use-action';

import { NewUserDialog } from '../new-user-dialog';
import { BulkTagDialog } from './bulk-tag-dialog';

export type UserRow = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  hasLogin: boolean;
  status: string;
  createdAt: string;
  tags: { slug: string; label: string; color: string | null }[];
};

export type TagOption = { slug: string; label: string };

const SORT_PARAM = 'sort';

/** "name:asc" → { id: 'name', direction: 'asc' } (the sort lives in the URL so a view can be linked). */
function parseSort(raw: string | null): SortState {
  const [id, direction] = (raw ?? '').split(':');
  return id && (direction === 'asc' || direction === 'desc') ? { id, direction } : null;
}

/**
 * The users list: sortable columns (kept in `?sort=`), row selection with a bulk bar (add tags,
 * archive — one transaction and one activity entry each, `contacts.bulkAddTags` / `contacts.bulkArchive`),
 * and on a phone each row becomes a card. Sorting reorders the page you are on; searching and filtering
 * (in the URL) work across everyone.
 */
export function UsersTable({
  rows,
  tags,
  canWrite,
  emptyIsFiltered,
}: {
  rows: UserRow[];
  tags: TagOption[];
  canWrite: boolean;
  emptyIsFiltered: boolean;
}) {
  const { formatDate } = useDates();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { run } = useAction();

  const tableLabels = useTableLabels();
  const columns: DataTableColumn<UserRow>[] = [
    {
      id: 'name',
      header: 'Name',
      label: 'Name',
      hideLabelOnCard: true,
      sortValue: (u) => u.displayName,
      cell: (u) => (
        <Link
          href={`/admin/users/${u.id}`}
          className="flex min-w-0 items-center gap-3 rounded-md font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar name={u.displayName} />
          <span className="min-w-0 truncate">{u.displayName}</span>
          {u.hasLogin && (
            <KeyIcon className="size-3 shrink-0 text-muted-foreground" aria-label="Has a login" />
          )}
          {u.status === 'archived' && <Badge color="outline">Archived</Badge>}
        </Link>
      ),
    },
    {
      id: 'email',
      header: 'Email',
      sortValue: (u) => u.email,
      cell: (u) => <span className="text-muted-foreground">{u.email ?? '—'}</span>,
    },
    {
      id: 'phone',
      header: 'Phone',
      cell: (u) => <span className="text-muted-foreground tabular-nums">{u.phone ?? '—'}</span>,
    },
    {
      id: 'tags',
      header: 'Tags',
      cell: (u) =>
        u.tags.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="flex flex-wrap gap-1 md:justify-start">
            {u.tags.map((t) => (
              <Badge key={t.slug} color={tagColor(t.color)}>
                {t.label}
              </Badge>
            ))}
          </span>
        ),
    },
    {
      id: 'added',
      header: 'Added',
      sortValue: (u) => new Date(u.createdAt),
      cell: (u) => <span className="text-muted-foreground">{formatDate(u.createdAt)}</span>,
    },
  ];

  function changeSort(next: SortState) {
    const query = new URLSearchParams(params.toString());
    if (next) query.set(SORT_PARAM, `${next.id}:${next.direction}`);
    else query.delete(SORT_PARAM);
    const qs = query.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  async function archive(ids: string[]) {
    const ok = await confirm({
      title: `Archive ${ids.length} ${ids.length === 1 ? 'user' : 'users'}?`,
      description:
        'Their logins and API keys stop working. You can restore them later from the Archived tab.',
      confirmLabel: 'Archive',
    });
    if (ok) await run('contacts.bulkArchive', { ids }, { success: 'Archived' });
  }

  return (
    <DataTable
      labels={tableLabels}
      caption="Users"
      rows={rows}
      getRowId={(u) => u.id}
      columns={columns}
      // Uncontrolled sorting (the table sorts the page itself); the URL only remembers the choice.
      defaultSort={parseSort(params.get(SORT_PARAM))}
      onSortChange={changeSort}
      selectable={canWrite}
      bulkActions={(ids) => (
        <>
          <BulkTagDialog ids={ids} tags={tags} />
          <Button
            size="sm"
            variant="destructive"
            icon={<ArchiveIcon />}
            onClick={() => archive(ids)}
          >
            Archive
          </Button>
        </>
      )}
      empty={
        <Empty
          icon={<UsersIcon />}
          title={emptyIsFiltered ? 'No matches' : 'No users yet'}
          description={
            emptyIsFiltered
              ? 'Try a different search or filter.'
              : 'People you add, import or who sign up show up here.'
          }
          contents={canWrite && !emptyIsFiltered ? <NewUserDialog tags={tags} /> : undefined}
        />
      }
    />
  );
}
