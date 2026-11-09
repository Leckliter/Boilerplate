'use client';

import { Badge } from '@app/ui/components/badge';
import { Button } from '@app/ui/components/button';
import { BarChart, DonutChart, Sparkline } from '@app/ui/components/charts';
import { DataTable, type DataTableColumn, type SortState } from '@app/ui/components/data-table';
import { Empty } from '@app/ui/components/empty';
import { ActionBar } from '@app/ui/components/action-bar';
import {
  ChartBarIcon,
  DownloadSimpleIcon,
  TrashIcon,
  UsersIcon,
  ReceiptIcon,
  MoneyIcon,
} from '@app/ui/components/icons';
import { Pill } from '@app/ui/components/pill';
import { StatTile } from '@app/ui/components/stat-tile';
import { formatMoney } from '@app/ui/lib/money';
import { useState } from 'react';

type Order = {
  id: string;
  number: string;
  customer: string;
  status: 'paid' | 'pending' | 'refunded';
  total: number;
  placed: string;
};

const ORDERS: Order[] = [
  {
    id: '1',
    number: 'A-1042',
    customer: 'Ada Lovelace',
    status: 'paid',
    total: 12900,
    placed: '2026-11-03T15:20:00Z',
  },
  {
    id: '2',
    number: 'A-1041',
    customer: 'Grace Hopper',
    status: 'pending',
    total: 4950,
    placed: '2026-11-02T18:05:00Z',
  },
  {
    id: '3',
    number: 'A-1040',
    customer: 'Alan Turing',
    status: 'paid',
    total: 23000,
    placed: '2026-11-01T09:45:00Z',
  },
  {
    id: '4',
    number: 'A-1039',
    customer: 'Katherine Johnson',
    status: 'refunded',
    total: 1999,
    placed: '2026-10-30T21:10:00Z',
  },
  {
    id: '5',
    number: 'A-1038',
    customer: 'Margaret Hamilton',
    status: 'paid',
    total: 8800,
    placed: '2026-10-29T12:00:00Z',
  },
];

const TONE = { paid: 'success', pending: 'warning', refunded: 'neutral' } as const;

const COLUMNS: DataTableColumn<Order>[] = [
  {
    id: 'number',
    header: 'Order',
    cell: (o) => <span className="font-medium">{o.number}</span>,
    sortValue: (o) => o.number,
    hideLabelOnCard: true,
  },
  { id: 'customer', header: 'Customer', cell: (o) => o.customer, sortValue: (o) => o.customer },
  {
    id: 'status',
    header: 'Status',
    cell: (o) => (
      <Pill tone={TONE[o.status]} dot size="sm">
        {o.status}
      </Pill>
    ),
    sortValue: (o) => o.status,
  },
  {
    id: 'total',
    header: 'Total',
    cell: (o) => <span className="tabular-nums">{formatMoney(o.total)}</span>,
    sortValue: (o) => o.total,
    align: 'end',
  },
];

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 gap-3">
      <h3 className="text-base font-semibold">{title}</h3>
      {children}
    </div>
  );
}

export function DataDemos() {
  const [sort, setSort] = useState<SortState>({ id: 'total', direction: 'desc' });
  const [loading, setLoading] = useState(false);
  return (
    <div className="grid gap-12">
      <Block title="DataTable: sorting, selection, bulk actions">
        <p className="text-sm text-muted-foreground">
          Click a header to sort (ascending, descending, none); tick rows for the bulk bar. Below
          768px each row becomes a card and sorting moves to a menu. Resize the window to see it.
        </p>
        <DataTable
          caption="Orders"
          columns={COLUMNS}
          rows={ORDERS}
          getRowId={(o) => o.id}
          selectable
          sort={sort}
          onSortChange={setSort}
          bulkActions={(ids) => (
            <>
              <Button size="sm" onClick={() => undefined}>
                <DownloadSimpleIcon /> Export {ids.length}
              </Button>
              <Button size="sm" variant="secondary-destructive">
                <TrashIcon /> Delete
              </Button>
            </>
          )}
        />
        <p className="text-xs text-muted-foreground">
          This demo passes <code className="font-mono">sort</code> +{' '}
          <code className="font-mono">onSortChange</code> without sorting server-side, so the rows
          below stay in place; the next one sorts itself.
        </p>
      </Block>
      <Block title="DataTable: uncontrolled, sticky header, states">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={loading ? 'primary' : 'secondary'}
            onClick={() => setLoading((v) => !v)}
          >
            {loading ? 'Stop loading' : 'Show loading'}
          </Button>
        </div>
        <DataTable
          caption="Orders (scrolls inside 14rem)"
          columns={COLUMNS}
          rows={[
            ...ORDERS,
            ...ORDERS.map((o) => ({ ...o, id: `${o.id}b`, number: `${o.number}-R` })),
          ]}
          getRowId={(o) => o.id}
          stickyHeader
          maxHeight="14rem"
          defaultSort={{ id: 'customer', direction: 'asc' }}
          loading={loading}
        />
        <DataTable
          caption="Empty orders"
          columns={COLUMNS}
          rows={[]}
          getRowId={(o) => o.id}
          empty={
            <Empty
              size="sm"
              icon={<ReceiptIcon />}
              title="No orders yet"
              description="Orders you take will show up here."
            />
          }
        />
      </Block>
      <Block title="ActionBar">
        <p className="text-sm text-muted-foreground">
          The bar DataTable shows for a selection; use it alone for any selection UI.
        </p>
        <ActionBar count={3} onClear={() => undefined}>
          <Button size="sm">Archive</Button>
          <Button size="sm" variant="secondary-destructive">
            Delete
          </Button>
        </ActionBar>
      </Block>
      <Block title="StatTile">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Revenue"
            value="$12,480"
            icon={<MoneyIcon />}
            delta={{ value: '+8.2%', direction: 'up', period: 'vs last month' }}
            chart={<Sparkline label="Revenue, last 8 weeks" data={[4, 6, 5, 8, 7, 9, 12, 11]} />}
          />
          <StatTile
            label="Orders"
            value="312"
            icon={<ReceiptIcon />}
            delta={{ value: '−3.1%', direction: 'down', period: 'vs last month' }}
          />
          <StatTile
            label="Refund rate"
            value="1.8%"
            delta={{ value: '−0.4 pts', direction: 'down', good: true }}
            hint="Lower is better"
          />
          <StatTile
            label="Customers"
            value="1,204"
            icon={<UsersIcon />}
            delta={{ value: 'no change', direction: 'flat' }}
          />
        </div>
      </Block>
      <Block title="Sparkline, BarChart, DonutChart">
        <p className="text-sm text-muted-foreground">
          Dependency-free SVG in chart tokens. Each is an image with a spoken summary and a hidden
          data table; <code className="font-mono">showTable</code> shows it.
        </p>
        <div className="grid min-w-0 gap-8 lg:grid-cols-2">
          <div className="min-w-0 rounded-lg bg-card p-4 ring ring-border">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <ChartBarIcon aria-hidden className="size-4 text-muted-foreground" /> Orders by day
              <Badge color="neutral" className="ml-auto">
                last 7 days
              </Badge>
            </div>
            <BarChart
              title="Orders by day"
              description="Last seven days."
              data={[
                { label: 'Mon', value: 12 },
                { label: 'Tue', value: 19 },
                { label: 'Wed', value: 8 },
                { label: 'Thu', value: 15 },
                { label: 'Fri', value: 24 },
                { label: 'Sat', value: 30 },
                { label: 'Sun', value: 17 },
              ]}
            />
          </div>
          <div className="min-w-0 rounded-lg bg-card p-4 ring ring-border">
            <p className="mb-2 text-sm font-medium">Revenue by plan</p>
            <DonutChart
              title="Revenue by plan"
              format={(c) => formatMoney(c, { trimZeros: true })}
              centerLabel="$12.5k"
              showTable
              data={[
                { label: 'Pro', value: 760000 },
                { label: 'Team', value: 340000 },
                { label: 'Free (donations)', value: 150000 },
              ]}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <span className="flex items-center gap-2">
            Up <Sparkline label="Up trend" data={[1, 2, 2, 4, 6]} className="w-24" />
          </span>
          <span className="flex items-center gap-2">
            Down <Sparkline label="Down trend" data={[8, 6, 6, 3, 1]} series={3} className="w-24" />
          </span>
          <span className="flex items-center gap-2">
            Flat{' '}
            <Sparkline
              label="Flat trend"
              data={[5, 5, 5, 5]}
              series={5}
              area={false}
              className="w-24"
            />
          </span>
        </div>
      </Block>
    </div>
  );
}
