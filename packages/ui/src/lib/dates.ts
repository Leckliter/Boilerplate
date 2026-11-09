/**
 * Dates and times in the app's configured time zone (default America/Chicago).
 * The server runs in UTC, so a plain toLocaleDateString() shows evening events as the
 * next day; always format through this file. Store UTC, display in the app zone.
 *
 * Client components: mount `<TimeZoneProvider zone>` (ui-context) so the browser shows the same
 * zone as the server, and read it with `useAppTimeZone()` / `useDates()`; every formatter also
 * takes an optional trailing `zone` argument.
 *
 * Change the zone once at startup with `setAppTimeZone('Europe/Berlin')` (e.g. from
 * `APP_TIME_ZONE`), or edit DEFAULT_TIME_ZONE. Formatters are rebuilt on change.
 */
export const DEFAULT_TIME_ZONE = 'America/Chicago';
let TZ = DEFAULT_TIME_ZONE;

/** The zone every helper below uses. */
export function getAppTimeZone(): string {
  return TZ;
}

/** Set the app's IANA time zone. Throws a RangeError for an unknown zone. */
export function setAppTimeZone(zone: string): void {
  new Intl.DateTimeFormat('en-US', { timeZone: zone }); // validates
  TZ = zone;
}

// Formatters read TZ at call time (a cheap cache keyed by zone + shape).
const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(
  locale: string,
  opts: Intl.DateTimeFormatOptions,
  zone: string = TZ,
): Intl.DateTimeFormat {
  const key = `${locale}|${zone}|${JSON.stringify(opts)}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { timeZone: zone, ...opts });
    cache.set(key, f);
  }
  return f;
}

const dateFmt = (zone?: string) =>
  fmt(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    },
    zone,
  );
const dateTimeFmt = (zone?: string) =>
  fmt(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    },
    zone,
  );
const isoDayFmt = (zone?: string) =>
  fmt(
    'en-CA',
    {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    },
    zone,
  );

type DateInput = Date | string | number;
const toDate = (d: DateInput) => (d instanceof Date ? d : new Date(d));

/** "Nov 3, 2026" */
export function formatDate(d: DateInput, zone?: string): string {
  return dateFmt(zone).format(toDate(d));
}

/** "Nov 3, 2026, 4:05 PM" */
export function formatDateTime(d: DateInput, zone?: string): string {
  return dateTimeFmt(zone).format(toDate(d));
}

/**
 * A calendar day stored as "YYYY-MM-DD" (a requested date, a purchase date) →
 * "Nov 3, 2026". It's a day, not a moment, so no time zone shift applies.
 */
export function formatDay(day: string): string {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return dateFmt().format(new Date(Date.UTC(y!, m! - 1, d!, 12)));
}

/** Today in the app time zone as "YYYY-MM-DD" (for <input type="date" min>). */
export function todayInAppZone(now: Date = new Date(), zone?: string): string {
  return isoDayFmt(zone).format(now);
}

/** "Nov 3, 2026, 4:05 PM", or "—" when there's no date (tables, timelines). */
export function formatWhen(d: DateInput | null | undefined, zone?: string): string {
  return d ? formatDateTime(d, zone) : '—';
}

/**
 * The moment a wall-clock time in the app zone happens, e.g. 9:00 on "2026-11-14"
 * → 15:00Z in winter (CST) or 14:00Z in summer (CDT) for America/Chicago.
 */
export function zonedTimeToDate(day: string, hour = 0, minute = 0, zone?: string): Date {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  const wanted = Date.UTC(y!, m! - 1, d!, hour, minute);
  // Read what the app zone's clock says at `wanted` (as if it were UTC) and shift by the gap.
  const parts: Record<string, number> = Object.fromEntries(
    fmt(
      'en-US',
      {
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      },
      zone,
    )
      .formatToParts(new Date(wanted))
      .map((p) => [p.type, Number(p.value)]),
  );
  const p = (k: string) => parts[k] ?? 0;
  const shown = Date.UTC(p('year'), p('month') - 1, p('day'), p('hour'), p('minute'));
  return new Date(wanted + (wanted - shown));
}

// ---------------------------------------------------------------- calendar days
// Days are "YYYY-MM-DD" strings in the app time zone; moments are Dates.

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

const minutesFmt = (zone?: string) =>
  fmt(
    'en-US',
    {
      hourCycle: 'h23',
      hour: 'numeric',
      minute: 'numeric',
    },
    zone,
  );

/** Minutes after midnight on the app zone's clock (9:30 AM → 570). */
export function minutesInAppZone(d: DateInput, zone?: string): number {
  const parts = Object.fromEntries(
    minutesFmt(zone)
      .formatToParts(toDate(d))
      .map((p) => [p.type, Number(p.value)]),
  );
  return (parts.hour ?? 0) * 60 + (parts.minute ?? 0);
}

const timeFmt = (zone?: string) =>
  fmt(
    'en-US',
    {
      hour: 'numeric',
      minute: '2-digit',
    },
    zone,
  );
const shortTimeFmt = (zone?: string) =>
  fmt(
    'en-US',
    {
      hour: 'numeric',
    },
    zone,
  );

/** "9:00 AM" */
export function formatTime(d: DateInput, zone?: string): string {
  return timeFmt(zone).format(toDate(d));
}

/** "9a", "2:30p" — for tight calendar cells. */
export function formatShortTime(d: DateInput, zone?: string): string {
  const date = toDate(d);
  const mins = minutesInAppZone(date, zone) % 60;
  const hour = shortTimeFmt(zone)
    .format(date)
    .replace(/\s?(AM|PM)/, '');
  const ap = /PM/.test(shortTimeFmt(zone).format(date)) ? 'p' : 'a';
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

/** "November 4, 2026" for a moment, as the app-zone day it falls on. */
export function formatDateLong(d: DateInput, zone?: string): string {
  return formatDayFull(todayInAppZone(toDate(d), zone));
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

const weekdayTimeFmt = (zone?: string) =>
  fmt(
    'en-US',
    {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    },
    zone,
  );

/** "Tue, Nov 4, 9:00 AM" (a moment, with its weekday: due times, bookings). */
export function formatWeekdayTime(d: DateInput, zone?: string): string {
  return weekdayTimeFmt(zone).format(toDate(d));
}
