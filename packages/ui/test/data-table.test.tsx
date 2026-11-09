import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DataTable, type DataTableColumn } from '../src/components/data-table';
import { axe } from './axe';

type Row = { id: string; name: string; qty: number | null };
const rows: Row[] = [
  { id: 'a', name: 'Cherry', qty: 3 },
  { id: 'b', name: 'Apple', qty: 10 },
  { id: 'c', name: 'Banana', qty: null },
];
const columns: DataTableColumn<Row>[] = [
  { id: 'name', header: 'Name', cell: (r) => r.name, sortValue: (r) => r.name },
  { id: 'qty', header: 'Qty', cell: (r) => r.qty ?? '—', sortValue: (r) => r.qty, align: 'end' },
  { id: 'note', header: 'Note', cell: () => 'ok' },
];

const bodyNames = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).queryAllByRole('cell')[0]?.textContent);

function setup(props: Partial<React.ComponentProps<typeof DataTable<Row>>> = {}) {
  return render(
    <DataTable caption="Fruit" columns={columns} rows={rows} getRowId={(r) => r.id} {...props} />,
  );
}

describe('DataTable sorting', () => {
  it('marks sortable headers with aria-sort and cycles asc → desc → none', async () => {
    const user = userEvent.setup();
    setup();
    const th = screen.getByRole('columnheader', { name: /name/i });
    expect(th).toHaveAttribute('aria-sort', 'none');
    expect(screen.getByRole('columnheader', { name: 'Note' })).not.toHaveAttribute('aria-sort');

    await user.click(within(th).getByRole('button'));
    expect(th).toHaveAttribute('aria-sort', 'ascending');
    expect(bodyNames()).toEqual(['Apple', 'Banana', 'Cherry']);

    await user.click(within(th).getByRole('button'));
    expect(th).toHaveAttribute('aria-sort', 'descending');
    expect(bodyNames()).toEqual(['Cherry', 'Banana', 'Apple']);

    await user.click(within(th).getByRole('button'));
    expect(th).toHaveAttribute('aria-sort', 'none');
    expect(bodyNames()).toEqual(['Cherry', 'Apple', 'Banana']);
  });

  it('keeps empty values last in both directions and sorts numbers numerically', async () => {
    const user = userEvent.setup();
    setup();
    const btn = within(screen.getByRole('columnheader', { name: /qty/i })).getByRole('button');
    await user.click(btn);
    expect(bodyNames()).toEqual(['Cherry', 'Apple', 'Banana']); // 3, 10, empty
    await user.click(btn);
    expect(bodyNames()).toEqual(['Apple', 'Cherry', 'Banana']); // 10, 3, empty
  });

  it('is operable by keyboard', async () => {
    const user = userEvent.setup();
    setup();
    within(screen.getByRole('columnheader', { name: /name/i }))
      .getByRole('button')
      .focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('columnheader', { name: /name/i })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  it('leaves ordering to the caller when sort + onSortChange are given', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    setup({ sort: null, onSortChange });
    await user.click(
      within(screen.getByRole('columnheader', { name: /name/i })).getByRole('button'),
    );
    expect(onSortChange).toHaveBeenCalledWith({ id: 'name', direction: 'asc' });
    expect(bodyNames()).toEqual(['Cherry', 'Apple', 'Banana']); // rows untouched
  });
});

describe('DataTable selection and states', () => {
  it('selects rows, shows the bulk action bar with the count, and clears', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    setup({
      selectable: true,
      bulkActions: (ids) => <button onClick={() => onDelete(ids)}>Delete</button>,
    });
    const bar = screen.getByRole('region', { name: 'Bulk actions' });
    expect(within(bar).queryByText(/selected/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Select row a' }));
    expect(within(bar).getAllByText('1 selected').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('checkbox', { name: 'Select row c' }));
    expect(within(bar).getAllByText('2 selected').length).toBeGreaterThan(0);

    await user.click(within(bar).getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(['a', 'c']);

    await user.click(within(bar).getByRole('button', { name: 'Clear' }));
    expect(screen.getByRole('checkbox', { name: 'Select row a' })).not.toBeChecked();
    expect(within(bar).queryByText(/selected/)).not.toBeInTheDocument();
  });

  it('select-all is indeterminate for a partial selection and toggles everything', async () => {
    const user = userEvent.setup();
    setup({ selectable: true });
    const all = screen.getByRole('checkbox', { name: /select all rows/i }) as HTMLInputElement;
    await user.click(screen.getByRole('checkbox', { name: 'Select row b' }));
    expect(all.indeterminate).toBe(true);
    await user.click(all);
    expect(all.checked).toBe(true);
    expect(
      screen
        .getAllByRole('checkbox', { name: /select row/i })
        .every((c) => (c as HTMLInputElement).checked),
    ).toBe(true);
    await user.click(all);
    expect(
      screen
        .getAllByRole('checkbox', { name: /select row/i })
        .some((c) => (c as HTMLInputElement).checked),
    ).toBe(false);
  });

  it('reports controlled selection changes', async () => {
    const user = userEvent.setup();
    const onSelectedIdsChange = vi.fn();
    setup({ selectable: true, selectedIds: ['a'], onSelectedIdsChange });
    expect(screen.getByRole('checkbox', { name: 'Select row a' })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Select row b' }));
    expect(onSelectedIdsChange).toHaveBeenCalledWith(['a', 'b']);
  });

  it('shows loading and empty states', () => {
    const { unmount } = setup({ loading: true });
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getAllByText('Loading').length).toBeGreaterThan(0);
    unmount();
    setup({ rows: [], empty: <p>No fruit yet</p> });
    expect(screen.getByText('No fruit yet')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = setup({ selectable: true });
    expect(await axe(container)).toHaveNoViolations();
  });
});
