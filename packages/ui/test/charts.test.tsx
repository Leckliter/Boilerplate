import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BarChart, DonutChart, Sparkline } from '../src/components/charts';
import { axe } from './axe';

const data = [
  { label: 'Mon', value: 12 },
  { label: 'Tue', value: 30 },
  { label: 'Wed', value: 18 },
];

describe('charts are readable without seeing them', () => {
  it('Sparkline is an image whose name states the range', () => {
    render(<Sparkline label="Daily orders" data={[3, 5, 4, 9]} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAccessibleName(/Daily orders\. 4 points, from 3 to 9, lowest 3, highest 9\./);
  });

  it('Sparkline copes with one point and no points', () => {
    const { unmount } = render(<Sparkline label="One" data={[7]} />);
    expect(screen.getByRole('img')).toHaveAccessibleName(/1 points/);
    unmount();
    render(<Sparkline label="None" data={[]} />);
    expect(screen.getByRole('img')).toHaveAccessibleName(/No data/);
  });

  it('BarChart has a described image and a data table fallback', () => {
    render(<BarChart title="Orders by day" description="Last three days." data={data} />);
    expect(screen.getByRole('img')).toHaveAccessibleName(
      /Orders by day\. Last three days\. 3 points/,
    );
    const table = screen.getByRole('table', { name: 'Orders by day' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(4); // header + 3
    expect(within(rows[2]!).getByRole('rowheader')).toHaveTextContent('Tue');
    expect(within(rows[2]!).getByRole('cell')).toHaveTextContent('30');
  });

  it('DonutChart names every segment with its share', () => {
    render(
      <DonutChart
        title="Revenue by plan"
        data={[
          { label: 'Pro', value: 75 },
          { label: 'Free', value: 25 },
        ]}
      />,
    );
    expect(screen.getByRole('img')).toHaveAccessibleName(/Pro 75 \(75%\), Free 25 \(25%\)/);
    expect(screen.getByRole('table', { name: 'Revenue by plan' })).toBeInTheDocument();
  });

  it('formats values with the given formatter', () => {
    render(
      <BarChart
        title="Revenue"
        data={[{ label: 'Q1', value: 4900 }]}
        format={(c) => `$${c / 100}`}
      />,
    );
    expect(screen.getByRole('img')).toHaveAccessibleName(/\$49/);
  });

  it('DonutChart with only zeros does not divide by zero', () => {
    render(<DonutChart title="Empty" data={[{ label: 'A', value: 0 }]} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <div>
        <Sparkline label="Trend" data={[1, 2, 3]} />
        <BarChart title="Bars" data={data} />
        <DonutChart title="Donut" data={data} />
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
