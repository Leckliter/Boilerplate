import { describe, expect, it } from 'vitest';

import { formatMoney, parseMoneyToCents } from '../src/lib/money';

describe('formatMoney', () => {
  it('formats integer cents', () => {
    expect(formatMoney(4900)).toBe('$49.00');
    expect(formatMoney(5)).toBe('$0.05');
    expect(formatMoney(123456789)).toBe('$1,234,567.89');
  });
  it('formats negatives and can trim whole amounts', () => {
    expect(formatMoney(-1250)).toBe('-$12.50');
    expect(formatMoney(4900, { trimZeros: true })).toBe('$49');
    expect(formatMoney(4950, { trimZeros: true })).toBe('$49.50');
  });
  it('shows a dash for nothing', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
    expect(formatMoney(Number.NaN)).toBe('—');
  });
  it('supports another currency and locale', () => {
    expect(formatMoney(1050, { currency: 'EUR', locale: 'de-DE' })).toMatch(/10,50\s€/);
  });
});

describe('parseMoneyToCents', () => {
  it.each([
    ['49', 4900],
    ['$49.00', 4900],
    ['1,234.5', 123450],
    ['.99', 99],
    ['0.07', 7],
    ['-12.5', -1250],
    ['(12.50)', -1250],
    ['  $ 3  ', 300],
  ])('parses %s', (input, cents) => {
    expect(parseMoneyToCents(input)).toBe(cents);
  });
  it.each(['', '  ', 'abc', '1.234', '12..5', '$', '1e3', '--5'])('rejects %j', (input) => {
    expect(parseMoneyToCents(input)).toBeNull();
  });
  it('round-trips with formatMoney', () => {
    for (const c of [0, 1, 99, 100, 123456]) {
      expect(parseMoneyToCents(formatMoney(c))).toBe(c);
    }
  });
  it('never returns -0', () => {
    expect(Object.is(parseMoneyToCents('-0'), 0)).toBe(true);
  });
});
