'use client';

import { prompt } from '@app/ui/components/alert-dialog';
import { Button } from '@app/ui/components/button';
import { DataTable, type DataTableColumn } from '@app/ui/components/data-table';
import { Empty } from '@app/ui/components/empty';
import { BugIcon, ChecksIcon } from '@app/ui/components/icons';
import { toast } from '@app/ui/components/toaster';
import { useDates } from '@app/ui/components/ui-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ErrorStatusBadge } from '@/components/admin/status-badges';
import { invokeAction } from '@/lib/invoke';
import { toastActionError } from '@/lib/use-action';

export type ErrorRow = {
  ref: string;
  fingerprint: string;
  message: string;
  code: string;
  where: string;
  count: number;
  openCount: number;
  lastSeen: string;
};

/**
 * The error groups as a table with a bulk "Mark fixed" (one note for all of them). There is no bulk
 * action in core, so it runs `errors.resolve` once per selected group and says how many it closed; each
 * call closes every repeat of that bug. Resolved groups can't be selected again (they have nothing open).
 */
export function ErrorsTable({ rows, canResolve }: { rows: ErrorRow[]; canResolve: boolean }) {
  const { formatWhen } = useDates();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const columns: DataTableColumn<ErrorRow>[] = [
    {
      id: 'error',
      header: 'Error',
      label: 'Error',
      hideLabelOnCard: true,
      className: 'max-w-md',
      sortValue: (r) => r.message,
      cell: (r) => (
        <Link
          href={`/admin/errors/${r.ref}`}
          className="grid min-w-0 gap-0.5 rounded-md outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="truncate font-medium">{r.message}</span>
          <span className="flex flex-wrap items-center gap-2 text-xs font-normal text-muted-foreground">
            <code>{r.ref}</code>
            <ErrorStatusBadge resolved={!r.openCount} />
            <code>{r.code}</code>
          </span>
        </Link>
      ),
    },
    {
      id: 'where',
      header: 'Where',
      cell: (r) => <span className="text-xs text-muted-foreground">{r.where}</span>,
    },
    {
      id: 'count',
      header: 'Times',
      align: 'end',
      sortValue: (r) => r.count,
      cell: (r) => <span className="tabular-nums">{r.count}</span>,
    },
    {
      id: 'last',
      header: 'Last seen',
      sortValue: (r) => new Date(r.lastSeen),
      cell: (r) => <span className="text-xs text-muted-foreground">{formatWhen(r.lastSeen)}</span>,
    },
  ];

  async function resolveMany(refs: string[]) {
    const open = rows.filter((r) => refs.includes(r.ref) && r.openCount > 0).map((r) => r.ref);
    if (open.length === 0) return toast('Those are already fixed.');
    const note = await prompt({
      title: `Mark ${open.length} ${open.length === 1 ? 'error' : 'errors'} fixed`,
      description:
        'Say what fixed them: a commit, a PR link or a short note. It is saved on each one.',
      confirmLabel: 'Mark fixed',
      label: 'What fixed them?',
      validate: (v) => (v.trim().length < 3 ? 'Write at least a few words.' : null),
      placeholder: 'Fixed in a1b2c3d (PR #42)',
    });
    if (!note) return;
    setBusy(true);
    try {
      let closed = 0;
      for (const ref of open) {
        const res = await invokeAction('errors.resolve', { ref, resolution: note });
        if (!res.ok) {
          toastActionError(`${ref}: ${res.error.message}`, res.error.ref);
          break;
        }
        closed++;
      }
      if (closed) toast.success(`Marked ${closed} ${closed === 1 ? 'error' : 'errors'} fixed.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <DataTable
      caption="Errors"
      rows={rows}
      columns={columns}
      getRowId={(r) => r.ref}
      defaultSort={{ id: 'last', direction: 'desc' }}
      selectable={canResolve}
      bulkActions={(refs) => (
        <Button size="sm" icon={<ChecksIcon />} loading={busy} onClick={() => resolveMany(refs)}>
          Mark fixed
        </Button>
      )}
      empty={
        <Empty
          icon={<BugIcon />}
          title="Nothing here"
          description="Errors from the last 90 days show up here, with repeats grouped."
        />
      }
    />
  );
}
