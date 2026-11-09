import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TimeZoneProvider, useAppTimeZone, useDates } from '../src/components/ui-context';
import {
  DEFAULT_TIME_ZONE,
  addDaysToDay,
  formatDate,
  formatDateTime,
  formatDay,
  getAppTimeZone,
  monthGridDays,
  setAppTimeZone,
  todayInAppZone,
  weekStartDay,
  zonedTimeToDate,
} from '../src/lib/dates';
import { cn } from '../src/lib/utils';

describe('cn', () => {
  const skipped = false as boolean;
  it('merges and lets later Tailwind classes win', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
    expect(cn('a', skipped && 'b', undefined, ['c'])).toBe('a c');
  });
});

describe('dates', () => {
  afterEach(() => setAppTimeZone(DEFAULT_TIME_ZONE));

  it('shows an evening moment on the right day in the app zone, not UTC', () => {
    // 02:30 UTC on Nov 4 is still the evening of Nov 3 in Chicago (CST, UTC-6).
    const d = new Date('2026-11-04T02:30:00Z');
    expect(formatDate(d)).toBe('Nov 3, 2026');
    expect(todayInAppZone(d)).toBe('2026-11-03');
    expect(formatDateTime(d)).toBe('Nov 3, 2026, 8:30 PM');
  });
  it('takes an explicit zone, and a changed default', () => {
    const d = new Date('2026-11-04T02:30:00Z');
    expect(formatDate(d, 'UTC')).toBe('Nov 4, 2026');
    setAppTimeZone('Asia/Tokyo');
    expect(getAppTimeZone()).toBe('Asia/Tokyo');
    expect(formatDate(d)).toBe('Nov 4, 2026');
    expect(() => setAppTimeZone('Not/AZone')).toThrow(RangeError);
  });
  it('formats a plain day without shifting it', () => {
    expect(formatDay('2026-11-03')).toBe('Nov 3, 2026');
  });
  it('does calendar-day arithmetic', () => {
    expect(addDaysToDay('2026-11-28', 5)).toBe('2026-12-03');
    expect(weekStartDay('2026-11-04')).toBe('2026-11-01');
    expect(monthGridDays('2026-11-15')).toHaveLength(42);
  });
  it('turns a wall-clock time in the zone into the right moment (CST and CDT)', () => {
    expect(zonedTimeToDate('2026-11-14', 9).toISOString()).toBe('2026-11-14T15:00:00.000Z');
    expect(zonedTimeToDate('2026-07-14', 9).toISOString()).toBe('2026-07-14T14:00:00.000Z');
    expect(zonedTimeToDate('2026-07-14', 9, 0, 'UTC').toISOString()).toBe(
      '2026-07-14T09:00:00.000Z',
    );
  });
});

describe('TimeZoneProvider', () => {
  function Probe() {
    const zone = useAppTimeZone();
    const { formatDate: fd } = useDates();
    return (
      <p>
        {zone} {fd(new Date('2026-11-04T02:30:00Z'))}
      </p>
    );
  }
  it('falls back to the app default without a provider', () => {
    render(<Probe />);
    expect(screen.getByText(`${DEFAULT_TIME_ZONE} Nov 3, 2026`)).toBeInTheDocument();
  });
  it('gives client components the zone the server chose', () => {
    render(
      <TimeZoneProvider zone="Asia/Tokyo">
        <Probe />
      </TimeZoneProvider>,
    );
    expect(screen.getByText('Asia/Tokyo Nov 4, 2026')).toBeInTheDocument();
  });
});
