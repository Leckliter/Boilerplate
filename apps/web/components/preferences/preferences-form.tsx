'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/ui/components/card';
import { NativeSelect } from '@app/ui/components/input';
import { Field } from '@app/ui/components/label';
import { LanguageSelect } from '@app/ui/components/language-select';
import { ThemeToggle } from '@app/ui/components/theme-toggle';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { LANGUAGE_NAMES, type Locale, LOCALE_COOKIE } from '@/i18n/locales';
import { COMMON_TIME_ZONES, TIME_ZONE_COOKIE } from '@/lib/timezone';

import { applyTheme, useTheme } from '../layout/theme-switch';

const YEAR = 60 * 60 * 24 * 365;

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${YEAR}; samesite=lax`;
}

/**
 * Theme, language and time zone. All three are per browser: the theme in localStorage (read before
 * first paint by lib/theme.ts), the language in the `locale` cookie (i18n/request.ts) and the time zone
 * in the `tz` cookie (read by ShellFor and handed to `TimeZoneProvider`). Changing one refreshes the
 * page's server text so it takes effect at once.
 */
export function PreferencesForm({
  locale,
  timeZone,
  appTimeZone,
}: {
  locale: Locale;
  /** The person's own zone, or '' to follow the business's. */
  timeZone: string;
  appTimeZone: string;
}) {
  const t = useTranslations('prefs');
  const router = useRouter();
  const theme = useTheme();
  const zones = [...new Set([appTimeZone, ...(timeZone ? [timeZone] : []), ...COMMON_TIME_ZONES])];
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('appearance')}</CardTitle>
          <CardDescription>{t('appearanceHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle value={theme} onChange={applyTheme} legend={t('theme')} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('language')}</CardTitle>
          <CardDescription>{t('languageHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <LanguageSelect
            label={t('language')}
            value={locale}
            languages={Object.entries(LANGUAGE_NAMES).map(([code, label]) => ({ code, label }))}
            onChange={(code) => {
              setCookie(LOCALE_COOKIE, code);
              router.refresh();
            }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('timeZone')}</CardTitle>
          <CardDescription>{t('timeZoneHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Field label={t('timeZone')} hideLabel>
            <NativeSelect
              aria-label={t('timeZone')}
              className="w-full max-w-md"
              value={timeZone}
              onChange={(e) => {
                setCookie(TIME_ZONE_COOKIE, e.target.value);
                router.refresh();
              }}
            >
              <option value="">{t('timeZoneDefault', { zone: appTimeZone })}</option>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, ' ')}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </CardContent>
      </Card>
    </>
  );
}
