import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CommandPalette } from '../src/components/command-palette';
import { Logo } from '../src/components/logo';
import { Meter } from '../src/components/meter';
import { Progress } from '../src/components/progress';
import { Radio } from '../src/components/radio';
import { SensitiveInput } from '../src/components/sensitive-input';
import { Slider } from '../src/components/slider';
import { Switch } from '../src/components/switch';
import { Tabs } from '../src/components/tabs';
import { axe } from './axe';

// jsdom has no ResizeObserver; Tabs watches its list for overflow.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

describe('accessible names', () => {
  it('names Meter and Progress from their label', async () => {
    const { container } = render(
      <>
        <Meter label="Storage used" value={30} />
        <Progress label="Importing" value={40} />
      </>,
    );
    expect(screen.getByRole('meter', { name: 'Storage used' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Importing' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('names Radio items and Slider thumbs', async () => {
    const { container } = render(
      <>
        <Radio.Group legend="Contact" defaultValue="email">
          <Radio.Item label="Email" value="email" />
          <Radio.Item label="Phone" value="phone" appearance="card" />
        </Radio.Group>
        <Slider aria-label="Volume" defaultValue={40} />
        <Slider label="Price" defaultValue={[20, 80]} />
      </>,
    );
    expect(screen.getByRole('radio', { name: 'Email' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Phone' })).toBeInTheDocument();
    // Base UI hides thumbs until measured (jsdom never does), so look at the inputs directly.
    const thumbs = [...container.querySelectorAll('input[type="range"]')].map((i) =>
      i.getAttribute('aria-label'),
    );
    expect(thumbs).toEqual(['Volume', 'Price minimum', 'Price maximum']);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('lets a Logo name its link without an aria-label on a span', async () => {
    const { container } = render(
      <a href="#top">
        <Logo name="Acme" compact />
      </a>,
    );
    expect(screen.getByRole('link', { name: 'Acme' })).toBeInTheDocument();
    expect(container.querySelector('span[aria-label]')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Switch', () => {
  it('honours defaultChecked', () => {
    render(<Switch label="Alerts" defaultChecked />);
    expect(screen.getByRole('switch', { name: 'Alerts' })).toBeChecked();
  });
});

describe('SensitiveInput', () => {
  it('has no button nested inside a button, and reveals from the keyboard', async () => {
    const user = userEvent.setup();
    const { container } = render(<SensitiveInput label="API key" defaultValue="sk_live_123" />);
    expect(await axe(container)).toHaveNoViolations();
    const reveal = screen.getByRole('button', { name: /API key, masked/ });
    reveal.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByLabelText('API key')).toHaveValue('sk_live_123');
    expect(screen.getByRole('button', { name: 'Hide value' })).toBeInTheDocument();
  });
});

describe('Tabs', () => {
  it('keeps a trailing control out of the tablist', async () => {
    const { container } = render(
      <Tabs
        tabs={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        trailing={<button type="button">Add tab</button>}
      />,
    );
    const list = screen.getByRole('tablist');
    const add = screen.getByRole('button', { name: 'Add tab' });
    expect(list.contains(add)).toBe(false);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders nothing, and does not break hooks, when the list goes empty', () => {
    function Harness() {
      const [empty, setEmpty] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setEmpty(!empty)}>
            toggle
          </button>
          <Tabs tabs={empty ? [] : [{ value: 'a', label: 'A' }]} />
        </>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    return user.click(screen.getByRole('button', { name: 'toggle' })).then(() => {
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    });
  });
});

describe('CommandPalette', () => {
  it('returns focus to the opener on Escape', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open palette
          </button>
          <CommandPalette
            open={open}
            onOpenChange={setOpen}
            query=""
            onQueryChange={vi.fn()}
            groups={[{ label: 'Pages', items: [{ id: 'home', label: 'Home' }] }]}
            onSelect={vi.fn()}
          />
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open palette' });
    await user.click(opener);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await vi.waitFor(() => expect(opener).toHaveFocus());
  });
});
