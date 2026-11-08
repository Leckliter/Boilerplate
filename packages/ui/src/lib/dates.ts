/**
 * Dates and times as people in Kansas City read them. Always Central time
 * (America/Chicago): the server runs in UTC, so a plain toLocaleDateString()
 * shows evening events as the next day. `pnpm rules` flags the plain form.
 */
const TZ = 'America/Chicago';

const dateFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const dateTimeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const isoDayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

type DateInput = Date | string | number;
const toDate = (d: DateInput) => (d instanceof Date ? d : new Date(d));

/** "Nov 3, 2026" */
export function formatDate(d: DateInput): string {
  return dateFmt.format(toDate(d));
}

/** "Nov 3, 2026, 4:05 PM" */
export function formatDateTime(d: DateInput): string {
  return dateTimeFmt.format(toDate(d));
}

/**
 * A calendar day stored as "YYYY-MM-DD" (a requested date, a purchase date) →
 * "Nov 3, 2026". It's a day, not a moment, so no time zone shift applies.
 */
export function formatDay(day: string): string {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return dateFmt.format(new Date(Date.UTC(y!, m! - 1, d!, 12)));
}

/** Today in Kansas City as "YYYY-MM-DD" (for <input type="date" min>). */
export function todayInCentral(now: Date = new Date()): string {
  return isoDayFmt.format(now);
}

/** "Nov 3, 2026, 4:05 PM", or "—" when there's no date (tables, timelines). */
export function formatWhen(d: DateInput | null | undefined): string {
  return d ? formatDateTime(d) : '—';
}

/**
 * The moment a Kansas City wall-clock time happens, e.g. 9:00 on "2026-11-14"
 * → 15:00Z in winter (CST, -6) or 14:00Z in summer (CDT, -5).
 */
export function centralTimeToDate(day: string, hour = 0, minute = 0): Date {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  const wanted = Date.UTC(y!, m! - 1, d!, hour, minute);
  // Read what Chicago's clock says at `wanted` (as if it were UTC) and shift by the gap.
  const parts: Record<string, number> = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    })
      .formatToParts(new Date(wanted))
      .map((p) => [p.type, Number(p.value)]),
  );
  const p = (k: string) => parts[k] ?? 0;
  const shown = Date.UTC(p('year'), p('month') - 1, p('day'), p('hour'), p('minute'));
  return new Date(wanted + (wanted - shown));
}

// ---------------------------------------------------------------- calendar days
// Days are "YYYY-MM-DD" strings in Kansas City time; moments are Dates.

/** "2026-11-04" + 3 → "2026-11-07". */
export function addDaysToDay(day: string, n: number): string {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + n, 12)).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOfDay(day: string): number {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12)).getUTCDay();
}

/** The Sunday that starts the week holding `day`. */
export function weekStartDay(day: string): string {
  return addDaysToDay(day, -weekdayOfDay(day));
}

/** The 42 days (6 weeks, Sunday first) a month view shows around `day`'s month. */
export function monthGridDays(day: string): string[] {
  const first = `${day.slice(0, 7)}-01`;
  const start = weekStartDay(first);
  return Array.from({ length: 42 }, (_, i) => addDaysToDay(start, i));
}

const minutesFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hourCycle: 'h23',
  hour: 'numeric',
  minute: 'numeric',
});

/** Minutes after midnight on Kansas City's clock (9:30 AM → 570). */
export function centralMinutes(d: DateInput): number {
  const parts = Object.fromEntries(
    minutesFmt.formatToParts(toDate(d)).map((p) => [p.type, Number(p.value)]),
  );
  return (parts.hour ?? 0) * 60 + (parts.minute ?? 0);
}

const timeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour: 'numeric',
  minute: '2-digit',
});
const shortTimeFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric' });

/** "9:00 AM" */
export function formatTime(d: DateInput): string {
  return timeFmt.format(toDate(d));
}

/** "9a", "2:30p" — for tight calendar cells. */
export function formatShortTime(d: DateInput): string {
  const date = toDate(d);
  const mins = centralMinutes(date) % 60;
  const hour = shortTimeFmt.format(date).replace(/\s?(AM|PM)/, '');
  const ap = /PM/.test(shortTimeFmt.format(date)) ? 'p' : 'a';
  return `${hour}${mins ? `:${String(mins).padStart(2, '0')}` : ''}${ap}`;
}

/** "Wed, Nov 4" (a day string). */
export function formatDayShort(day: string): string {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(Date.UTC(y!, m! - 1, d!, 12)));
}

/** "November 2026" (a day string's month). */
export function formatMonth(day: string): string {
  const [y, m] = day.slice(0, 7).split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(y!, m! - 1, 15)));
}

/** "November 4, 2026" (a day string, written out in full). */
export function formatDayFull(day: string): string {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(Date.UTC(y!, m! - 1, d!, 12)));
}

/** "November 4, 2026" for a moment, as the Central-time day it falls on. */
export function formatDateLong(d: DateInput): string {
  return formatDayFull(todayInCentral(toDate(d)));
}

/** "Tuesday, November 4" (a day string, for a page title). */
export function formatDayTitle(day: string): string {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(Date.UTC(y!, m! - 1, d!, 12)));
}

const weekdayTimeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** "Tue, Nov 4, 9:00 AM" (a moment, with its weekday: due times, bookings). */
export function formatWeekdayTime(d: DateInput): string {
  return weekdayTimeFmt.format(toDate(d));
}
