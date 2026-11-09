import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import { isLocale, LOCALE_COOKIE, type Locale } from './locales';

/**
 * next-intl without URL prefixes: the language is a cookie (`locale`, set from Account → Preferences).
 * Add a language: see i18n/locales.ts.
 * Keep strings in components literal English unless they are shell, nav, auth or error copy.
 */
export default getRequestConfig(async () => {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(stored) ? stored : 'en';
  return {
    locale,
    // Missing Spanish keys fall back to English instead of showing a key.
    messages: await loadMessages(locale),
  };
});

type Messages = Record<string, Record<string, unknown>>;

async function loadMessages(locale: Locale): Promise<Messages> {
  const en = (await import('../messages/en.json')).default as Messages;
  if (locale === 'en') return en;
  const other = (await import(`../messages/${locale}.json`)).default as Messages;
  return Object.fromEntries(
    Object.entries(en).map(([ns, keys]) => [ns, { ...keys, ...other[ns] }]),
  ) as Messages;
}
