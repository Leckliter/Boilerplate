/** Supported languages. Add one: its code here, a `messages/<code>.json`, and a name below. */
export const LOCALES = ['en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = 'locale';

export const LANGUAGE_NAMES: Record<Locale, string> = { en: 'English', es: 'Español' };

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
