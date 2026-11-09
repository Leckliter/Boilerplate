import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Avatar, initialsOf } from '../src/components/avatar';
import { Sparkline } from '../src/components/charts';
import { DataTable } from '../src/components/data-table';
import { NotificationList } from '../src/components/notification-list';
import { Steps } from '../src/components/steps';
import { ThemeToggle } from '../src/components/theme-toggle';
import { Wizard } from '../src/components/wizard';

describe('labels (English defaults, overridable)', () => {
  it('ThemeToggle', () => {
    const { unmount } = render(<ThemeToggle value="light" onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument();
    unmount();
    render(
      <ThemeToggle
        value="dark"
        onChange={() => {}}
        labels={{ legend: 'Tema', light: 'Claro', dark: 'Oscuro', system: 'Sistema' }}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toBeChecked();
    expect(screen.getByRole('group', { name: 'Tema' })).toBeInTheDocument();
  });

  it('Wizard and Steps', () => {
    const steps = [
      { id: 'a', label: 'Uno', content: <p>one</p> },
      { id: 'b', label: 'Dos', content: <p>two</p> },
    ];
    const { unmount } = render(<Wizard steps={steps} onFinish={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Progress' })).toBeInTheDocument();
    unmount();
    render(
      <Wizard
        steps={steps}
        onFinish={vi.fn()}
        labels={{
          region: 'Paso a paso',
          back: 'Atrás',
          next: 'Siguiente',
          stepOf: (n, total) => `Paso ${n} de ${total}:`,
          steps: { progress: 'Progreso' },
        }}
      />,
    );
    expect(screen.getByRole('region', { name: 'Paso a paso' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Progreso' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByRole('heading', { name: /Paso 2 de 2:/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atrás' })).toBeEnabled();
  });

  it('Steps go-back button', () => {
    render(
      <Steps
        steps={['A', 'B']}
        current={1}
        onStepClick={() => {}}
        labels={{ goBack: (l) => `Volver a ${l}` }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Volver a A' })).toBeInTheDocument();
  });

  it('NotificationList', () => {
    render(
      <NotificationList
        items={[{ id: '1', title: 'Hola', read: false }]}
        onMarkRead={() => {}}
        onMarkAllRead={() => {}}
        labels={{ unread: (n) => `${n} sin leer`, markAsRead: 'Marcar como leída' }}
      />,
    );
    expect(screen.getByText('1 sin leer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar como leída' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark all read/ })).toBeInTheDocument();
  });

  it('DataTable', () => {
    render(
      <DataTable
        caption="Things"
        rows={[]}
        getRowId={(r: { id: string }) => r.id}
        columns={[{ id: 'a', header: 'A', cell: () => null, sortValue: () => 1 }]}
        labels={{ empty: 'Nada por aquí.', sortBy: 'Ordenar por' }}
      />,
    );
    expect(screen.getByText('Nada por aquí.')).toBeInTheDocument();
    expect(screen.getByText('Ordenar por')).toBeInTheDocument();
  });
});

describe('Avatar', () => {
  it('shows initials, or the picture with initials as the fallback', () => {
    expect(initialsOf('Olivia Owner')).toBe('OO');
    const { container, rerender } = render(<Avatar name="Olivia Owner" />);
    expect(container.textContent).toBe('OO');
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    rerender(<Avatar name="Olivia Owner" src="/a.png" />);
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', '/a.png');
    expect(img).toHaveAttribute('alt', '');
    fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('OO');
  });

  it('is a labelled image when it has an alt', () => {
    render(<Avatar name="Olivia Owner" alt="Olivia Owner" />);
    expect(screen.getByRole('img', { name: 'Olivia Owner' })).toBeInTheDocument();
  });
});

describe('Sparkline size', () => {
  it('takes pixel dimensions or fills its container', () => {
    const { container, rerender } = render(<Sparkline label="x" data={[1, 2, 3]} width={240} />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('width', '240');
    expect(svg).toHaveAttribute('height', '64');
    rerender(<Sparkline label="x" data={[1, 2, 3]} width="fill" height={48} />);
    expect(container.querySelector('svg')!.getAttribute('class')).toContain('w-full');
    expect(container.querySelector('svg')).toHaveAttribute('height', '48');
  });
});
