import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Accordion, AccordionItem } from '../src/components/accordion';
import { AvatarUpload } from '../src/components/avatar-upload';
import { FileDrop } from '../src/components/file-drop';
import { InlineEdit } from '../src/components/inline-edit';
import { KeyValueList } from '../src/components/key-value-list';
import { LanguageSelect } from '../src/components/language-select';
import { Logo } from '../src/components/logo';
import { NotificationList } from '../src/components/notification-list';
import { Pill, StatusDot } from '../src/components/pill';
import { Progress } from '../src/components/progress';
import { SearchInput } from '../src/components/search-input';
import { StatTile } from '../src/components/stat-tile';
import { ThemeToggle } from '../src/components/theme-toggle';
import { Timeline } from '../src/components/timeline';
import { Wizard } from '../src/components/wizard';
import { axe } from './axe';

describe('SearchInput', () => {
  it('clears with the button and with Escape, and keeps focus', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SearchInput aria-label="Search orders" onValueChange={onValueChange} />);
    const input = screen.getByRole('searchbox', { name: 'Search orders' });
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
    await user.type(input, 'abc');
    expect(input).toHaveValue('abc');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    await user.type(input, 'x{Escape}');
    expect(input).toHaveValue('');
    expect(onValueChange).toHaveBeenLastCalledWith('');
  });
});

describe('Wizard', () => {
  it('walks forward and back, blocks Next while invalid, and finishes on the last step', async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    const { rerender } = render(
      <Wizard
        onFinish={onFinish}
        finishLabel="Place order"
        steps={[
          { id: 'a', label: 'Details', content: <p>Details form</p>, valid: false },
          { id: 'b', label: 'Payment', content: <p>Payment form</p> },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    rerender(
      <Wizard
        onFinish={onFinish}
        finishLabel="Place order"
        steps={[
          { id: 'a', label: 'Details', content: <p>Details form</p> },
          { id: 'b', label: 'Payment', content: <p>Payment form</p> },
        ]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Payment form')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Step 2 of 2: Payment/ })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Details form')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Place order' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});

describe('ThemeToggle', () => {
  it('is a radio group that reports the choice', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ThemeToggle value="light" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(onChange).toHaveBeenCalledWith('dark');
  });
});

describe('LanguageSelect', () => {
  it('reports the chosen language', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <LanguageSelect
        value="en"
        onChange={onChange}
        languages={[
          { code: 'en', label: 'English' },
          { code: 'es', label: 'Español' },
        ]}
      />,
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'es');
    expect(onChange).toHaveBeenCalledWith('es');
  });
});

describe('InlineEdit', () => {
  it('saves on Enter, cancels on Escape, and shows a refusal without closing', async () => {
    const user = userEvent.setup();
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error('Name is taken'))
      .mockResolvedValue(undefined);
    render(<InlineEdit label="Project name" value="Alpha" onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: 'Edit Project name' }));
    const input = screen.getByRole('textbox', { name: 'Project name' });
    await user.clear(input);
    await user.type(input, 'Beta{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Name is taken');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    await user.type(input, '2{Enter}');
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
    expect(onSave).toHaveBeenLastCalledWith('Beta2');

    await user.click(screen.getByRole('button', { name: 'Edit Project name' }));
    await user.type(screen.getByRole('textbox'), 'zzz{Escape}');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(onSave).toHaveBeenCalledTimes(2);
  });
});

describe('NotificationList', () => {
  it('marks unread items for screen readers and reports marking read', async () => {
    const user = userEvent.setup();
    const onMarkRead = vi.fn();
    const onMarkAllRead = vi.fn();
    render(
      <NotificationList
        onMarkRead={onMarkRead}
        onMarkAllRead={onMarkAllRead}
        items={[
          { id: '1', title: 'Order shipped', read: false, at: '2026-11-04T02:30:00Z' },
          { id: '2', title: 'Welcome', read: true },
        ]}
      />,
    );
    expect(screen.getByText('1 unread')).toBeInTheDocument();
    expect(screen.getByText(/Unread:/)).toBeInTheDocument();
    expect(screen.getByText('Nov 3, 2026, 8:30 PM')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark as read' }));
    expect(onMarkRead).toHaveBeenCalledWith('1');
    await user.click(screen.getByRole('button', { name: /Mark all read/ }));
    expect(onMarkAllRead).toHaveBeenCalled();
  });
  it('shows the empty text', () => {
    render(<NotificationList items={[]} />);
    expect(screen.getByText('You are all caught up.')).toBeInTheDocument();
  });
});

describe('FileDrop states', () => {
  it('announces errors and blocks picking while uploading', () => {
    const { rerender } = render(<FileDrop onFiles={() => {}} status="error" message="Too big" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Too big');
    rerender(<FileDrop onFiles={() => {}} status="uploading" progress={40} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('progressbar', { name: 'Upload progress' })).toBeInTheDocument();
  });
});

describe('AvatarUpload', () => {
  it('rejects the wrong type and too-large files, accepts a good one without a network call', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onChange = vi.fn();
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
    render(<AvatarUpload name="Sam Lee" onChange={onChange} maxBytes={10} />);
    const input = screen.getByLabelText('Upload a picture for Sam Lee');
    await user.upload(input, new File(['x'], 'a.txt', { type: 'text/plain' }));
    expect(screen.getByRole('alert')).toHaveTextContent('PNG, JPG or WebP');
    await user.upload(input, new File(['x'.repeat(50)], 'a.png', { type: 'image/png' }));
    expect(screen.getByRole('alert')).toHaveTextContent('too large');
    expect(onChange).not.toHaveBeenCalled();
    const ok = new File(['x'], 'a.png', { type: 'image/png' });
    await user.upload(input, ok);
    expect(onChange).toHaveBeenCalledWith(ok);
    expect(screen.getByRole('img', { name: 'Sam Lee' })).toHaveAttribute('src', 'blob:preview');
    await user.click(screen.getByRole('button', { name: /Remove/ }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

describe('Logo', () => {
  it('inverts the mark on brand backgrounds so it stays visible', () => {
    const { container } = render(<Logo compact tone="onBrand" />);
    const mark = container.querySelector('span[aria-hidden]')!;
    expect(mark.className).toContain('bg-primary-foreground');
    expect(mark.className).not.toMatch(/(^| )bg-primary( |$)/);
  });
});

describe('accessibility (axe)', () => {
  it('has no violations in key components', async () => {
    const { container } = render(
      <main>
        <h1>Page</h1>
        <StatTile label="Revenue" value="$12" delta={{ value: '+8%', direction: 'up' }} />
        <Pill tone="success" dot>
          Paid
        </Pill>
        <StatusDot tone="danger" label="Offline" />
        <KeyValueList items={[{ label: 'Plan', value: 'Pro' }]} />
        <Progress label="Importing" value={40} />
        <Accordion defaultValue={['a']}>
          <AccordionItem value="a" title="Question" headingLevel={2}>
            Answer
          </AccordionItem>
        </Accordion>
        <Timeline items={[{ id: '1', title: 'Placed', at: '2026-11-04T02:30:00Z' }]} />
        <SearchInput aria-label="Search" />
        <ThemeToggle value="dark" onChange={() => {}} />
        <LanguageSelect
          value="en"
          onChange={() => {}}
          languages={[{ code: 'en', label: 'English' }]}
        />
        <NotificationList items={[{ id: '1', title: 'Hi', read: false }]} onMarkRead={() => {}} />
        <InlineEdit label="Name" value="A" onSave={() => {}} />
        <FileDrop onFiles={() => {}} />
        <AvatarUpload name="Sam" onChange={() => {}} />
      </main>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
