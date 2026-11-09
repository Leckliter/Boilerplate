import { afterEach, describe, expect, it, vi } from 'vitest';

import { countByDay, dayLabels, lastDays, withinHours } from './admin-stats';

afterEach(() => vi.useRealTimers());

describe('admin stats helpers', () => {
  it('lastDays ends today and counts back, oldest first', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-09T18:00:00Z'));
    expect(lastDays(3)).toEqual(['2026-11-07', '2026-11-08', '2026-11-09']);
  });

  it('countByDay buckets by the app time zone, not UTC, and ignores the rest', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-09T18:00:00Z'));
    const days = lastDays(3);
    // 03:30 UTC on the 9th is still the evening of the 8th in Chicago.
    const counts = countByDay(
      [
        '2026-11-09T03:30:00Z',
        '2026-11-09T15:00:00Z',
        '2026-11-09T16:00:00Z',
        '2026-01-01T00:00:00Z',
      ],
      days,
    );
    expect(counts).toEqual([0, 1, 2]);
  });

  it('labels days by day of the month', () => {
    expect(dayLabels(['2026-11-07', '2026-11-10'])).toEqual(['7', '10']);
  });

  it('withinHours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-09T12:00:00Z'));
    expect(withinHours('2026-11-09T01:00:00Z', 24)).toBe(true);
    expect(withinHours('2026-11-07T12:00:00Z', 24)).toBe(false);
  });
});
