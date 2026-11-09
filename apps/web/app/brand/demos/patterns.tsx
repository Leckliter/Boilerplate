'use client';

import { Badge } from '@app/ui/components/badge';
import { Button, buttonVariants } from '@app/ui/components/button';
import { Callout } from '@app/ui/components/callout';
import { Card, CardContent } from '@app/ui/components/card';
import { ErrorReference } from '@app/ui/components/copy-button';
import { DataTable, type DataTableColumn } from '@app/ui/components/data-table';
import { DetailItem, DetailList } from '@app/ui/components/detail-list';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@app/ui/components/dialog';
import { Empty } from '@app/ui/components/empty';
import { PlusIcon, ReceiptIcon, WarningOctagonIcon } from '@app/ui/components/icons';
import { Input } from '@app/ui/components/input';
import { Field } from '@app/ui/components/label';
import { PageHeader, RecordHeader } from '@app/ui/components/page';
import { Pill } from '@app/ui/components/pill';
import { SearchInput } from '@app/ui/components/search-input';
import { SummaryList, SummaryRow } from '@app/ui/components/summary';
import { Timeline } from '@app/ui/components/timeline';
import { toast } from '@app/ui/components/toaster';
import { formatMoney } from '@app/ui/lib/money';
import { useState } from 'react';

function Recipe({
  title,
  rule,
  children,
}: {
  title: string;
  rule: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-3">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{rule}</p>
      </div>
      <div className="min-w-0 rounded-xl border border-dashed border-border bg-background p-4 sm:p-6">
        {children}
      </div>
    </div>
  );
}

type Row = { id: string; name: string; email: string; plan: string; spent: number };
const ROWS: Row[] = [
  { id: '1', name: 'Ada Lovelace', email: 'ada@example.com', plan: 'Pro', spent: 129000 },
  { id: '2', name: 'Grace Hopper', email: 'grace@example.com', plan: 'Team', spent: 49500 },
  { id: '3', name: 'Alan Turing', email: 'alan@example.com', plan: 'Free', spent: 0 },
];
const COLS: DataTableColumn<Row>[] = [
  {
    id: 'name',
    header: 'Customer',
    cell: (r) => (
      <a href="#patterns" className="font-medium underline-offset-4 hover:underline">
        {r.name}
      </a>
    ),
    sortValue: (r) => r.name,
    hideLabelOnCard: true,
  },
  { id: 'email', header: 'Email', cell: (r) => r.email, className: 'text-muted-foreground' },
  {
    id: 'plan',
    header: 'Plan',
    cell: (r) => (
      <Pill size="sm" tone={r.plan === 'Free' ? 'neutral' : 'brand'}>
        {r.plan}
      </Pill>
    ),
    sortValue: (r) => r.plan,
  },
  {
    id: 'spent',
    header: 'Spent',
    cell: (r) => formatMoney(r.spent),
    sortValue: (r) => r.spent,
    align: 'end',
  },
];

function ListPage() {
  const [q, setQ] = useState('');
  const shown = ROWS.filter((r) => `${r.name} ${r.email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="grid gap-4">
      <PageHeader
        title="Customers"
        description="Everyone who has bought or signed up."
        actions={
          <Button variant="primary">
            <PlusIcon /> New customer
          </Button>
        }
        className="pb-0"
      />
      <div className="max-w-sm">
        <SearchInput
          aria-label="Search customers"
          placeholder="Search name or email"
          value={q}
          onValueChange={setQ}
        />
      </div>
      <DataTable
        caption="Customers"
        columns={COLS}
        rows={shown}
        getRowId={(r) => r.id}
        empty={
          <Empty
            size="sm"
            icon={<ReceiptIcon />}
            title="No customers match"
            description="Try a different name or clear the search."
            contents={<Button onClick={() => setQ('')}>Clear search</Button>}
          />
        }
      />
    </div>
  );
}

function RecordPage() {
  return (
    <div className="grid gap-4">
      <RecordHeader
        back={<a href="#patterns">← Orders</a>}
        title="Order A-1042"
        badges={
          <Pill tone="success" dot>
            Paid
          </Pill>
        }
        meta="Placed Nov 3, 2026 by Ada Lovelace"
        actions={
          <>
            <Button>Refund</Button>
            <Button variant="primary">Mark shipped</Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="grid min-w-0 gap-4">
          <Card>
            <CardContent>
              <h4 className="mb-3 text-base font-semibold">Details</h4>
              <DetailList>
                <DetailItem label="Customer">Ada Lovelace</DetailItem>
                <DetailItem label="Ship to">12 Analytical Way, Kansas City, MO</DetailItem>
                <DetailItem label="Note" />
              </DetailList>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <h4 className="mb-3 text-base font-semibold">Activity</h4>
              <Timeline
                items={[
                  {
                    id: '1',
                    title: 'Payment received',
                    at: '2026-11-03T15:20:00Z',
                    tone: 'success',
                  },
                  { id: '2', title: 'Order placed', at: '2026-11-03T15:19:00Z' },
                ]}
              />
            </CardContent>
          </Card>
        </div>
        <Card className="self-start">
          <CardContent>
            <SummaryList>
              <SummaryRow label="Subtotal" value={formatMoney(11900)} />
              <SummaryRow label="Shipping" value={formatMoney(1000)} />
              <SummaryRow label="Total" value={formatMoney(12900)} total />
            </SummaryList>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FormDialogPattern() {
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => (setOpen(o), setError(null))}>
      <DialogTrigger render={<Button variant="primary" />}>
        <PlusIcon /> New project
      </DialogTrigger>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const name = String(new FormData(e.currentTarget).get('name') ?? '').trim();
            if (name.length < 2)
              return setError('Give the project a name of at least two letters.');
            toast.success(`Created ${name}`);
            setOpen(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Projects group your work. You can rename it later.
            </DialogDescription>
          </DialogHeader>
          <Field label="Project name" hint="Shown in the sidebar." error={error}>
            <Input name="name" autoComplete="off" />
          </Field>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" type="button" />}>Cancel</DialogClose>
            <Button variant="primary" type="submit">
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PatternDemos() {
  return (
    <div className="grid gap-12">
      <Recipe
        title="List page"
        rule="PageHeader (title, one primary action) → SearchInput → DataTable in a card. Rows link to the record; the empty state offers the way out."
      >
        <ListPage />
      </Recipe>
      <Recipe
        title="Record page"
        rule="RecordHeader (back, title, status, actions) → details read-only in cards (EditableCard for editing) → Timeline for history → SummaryList for totals."
      >
        <RecordPage />
      </Recipe>
      <Recipe
        title="Form dialog"
        rule="An Add/Edit button opens a dialog with one form: Field per control, errors under the field, Cancel left of a primary verb button. In apps/web use FormDialog + ActionForm."
      >
        <FormDialogPattern />
      </Recipe>
      <Recipe
        title="Empty state"
        rule="Say what belongs here and give one action. First-use empties teach; filtered empties offer to clear the filter."
      >
        <Empty
          icon={<ReceiptIcon />}
          title="No invoices yet"
          description="Invoices appear here once you send your first quote."
          contents={
            <Button variant="primary">
              <PlusIcon /> Create invoice
            </Button>
          }
        />
      </Recipe>
      <Recipe
        title="Error state"
        rule="Say what went wrong in plain words, what to do next, and show the E-… reference to quote. Never swallow the error: report it and show the reference."
      >
        <div className="mx-auto grid max-w-md gap-4 text-center">
          <WarningOctagonIcon aria-hidden className="mx-auto size-8 text-destructive" />
          <h4 className="text-lg font-semibold">We could not load your orders</h4>
          <p className="text-sm text-muted-foreground">
            Nothing was lost. Try again, and if it keeps happening, quote this reference to support.
          </p>
          <div className="flex justify-center">
            <ErrorReference reference="E-7K3QX9MD" />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="primary">Try again</Button>
            <a href="#patterns" className={buttonVariants()}>
              Back to dashboard
            </a>
          </div>
          <Callout tone="danger">The payment was not taken. You have not been charged.</Callout>
        </div>
      </Recipe>
      <Recipe
        title="Status words"
        rule="Pill for state (Paid, Late), Badge for tags and counts. Pair colour with words."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="success" dot>
            Paid
          </Pill>
          <Pill tone="warning" dot>
            Due in 3 days
          </Pill>
          <Pill tone="danger" dot>
            Late
          </Pill>
          <Badge color="neutral">Wholesale</Badge>
        </div>
      </Recipe>
    </div>
  );
}
