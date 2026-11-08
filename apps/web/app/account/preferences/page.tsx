import { getAppTimeZone } from '@app/ui/lib/dates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/ui/components/card';
import { DetailItem, DetailList } from '@app/ui/components/detail-list';
import { Field } from '@app/ui/components/label';
import { PageHeader } from '@app/ui/components/page';
import { cookies } from 'next/headers';

import { LanguageSelector } from '@/components/account/language-selector';
import { ThemeSwitch } from '@/components/layout/theme-switch';
import { isLocale, LOCALE_COOKIE } from '@/i18n/locales';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Preferences' };

/** Per-device preferences: theme and language live in this browser; the time zone is the app's (APP_TIME_ZONE). */
export default async function PreferencesPage() {
  await requireViewer(undefined, '/account/preferences');
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <PageHeader title="Preferences" description="Saved in this browser." />
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Light, dark, or follow your device.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSwitch />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Language</CardTitle>
          <CardDescription>The language of menus and messages. Page content may stay in English.</CardDescription>
        </CardHeader>
        <CardContent>
          <Field label="Language" hideLabel>
            <LanguageSelector value={isLocale(stored) ? stored : 'en'} />
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Time zone</CardTitle>
          <CardDescription>Dates and times are shown in the business’s time zone, whatever your device says.</CardDescription>
        </CardHeader>
        <CardContent>
          <DetailList>
            <DetailItem label="Time zone">{getAppTimeZone()}</DetailItem>
          </DetailList>
        </CardContent>
      </Card>
    </div>
  );
}
