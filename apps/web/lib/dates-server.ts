import 'server-only';

import {
  formatDate,
  formatDateTime,
  formatTime,
  formatWeekdayTime,
  formatWhen,
  todayInAppZone,
} from '@app/ui/lib/dates';

import { getViewerTimeZone } from './viewer-prefs';

/**
 * The date formatters for a server component, bound to the signed-in person's time zone (the `tz`
 * cookie set under Account → Preferences), else the app's `APP_TIME_ZONE`:
 *
 *   const { formatDateTime } = await getServerDates();
 *
 * Use this instead of importing `formatDate` from `@app/ui/lib/dates` in admin/account server pages,
 * so the page shows the same times as the shell and the client components (`useDates()`).
 */
export async function getServerDates() {
  const zone = await getViewerTimeZone();
  return {
    zone,
    formatDate: (d: Parameters<typeof formatDate>[0]) => formatDate(d, zone),
    formatDateTime: (d: Parameters<typeof formatDateTime>[0]) => formatDateTime(d, zone),
    formatWhen: (d: Parameters<typeof formatWhen>[0]) => formatWhen(d, zone),
    formatTime: (d: Parameters<typeof formatTime>[0]) => formatTime(d, zone),
    formatWeekdayTime: (d: Parameters<typeof formatWeekdayTime>[0]) => formatWeekdayTime(d, zone),
    todayInAppZone: () => todayInAppZone(new Date(), zone),
  };
}
