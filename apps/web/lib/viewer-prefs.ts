import 'server-only';

import { getAppTimeZone } from '@app/ui/lib/dates';
import { cookies } from 'next/headers';

import { isLocale, LOCALE_COOKIE, type Locale } from '@/i18n/locales';

import { isTimeZone, TIME_ZONE_COOKIE } from './timezone';

/** The zone to show dates in for this person: their `tz` cookie, else the app's. */
export async function getViewerTimeZone(): Promise<string> {
  const stored = (await cookies()).get(TIME_ZONE_COOKIE)?.value;
  return isTimeZone(stored) ? stored : getAppTimeZone();
}

/** The person's language (the `locale` cookie, default English). */
export async function getViewerLocale(): Promise<Locale> {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(stored) ? stored : 'en';
}
