/**
 * The time zone dates are shown in. The business has one (`APP_TIME_ZONE`, default America/Chicago); a
 * signed-in person may pick their own under Account → Preferences, kept in the `tz` cookie. The cookie is
 * only a display preference: storage is always UTC and the business rules (quiet hours …) use the app's zone.
 */
export const TIME_ZONE_COOKIE = 'tz';

/** Is this a zone the browser's Intl knows? (Guards the cookie, which anyone can edit.) */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    // Expected: an unknown zone name throws a RangeError — that is the answer "no".
    return false;
  }
}

/** Zones offered in the picker: the common ones, plus the app's own and the person's current one. */
export const COMMON_TIME_ZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Berlin',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
];
