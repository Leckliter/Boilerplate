import { PageHeader } from '@app/ui/components/page';
import { getAppTimeZone } from '@app/ui/lib/dates';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';

import { PreferencesForm } from '@/components/preferences/preferences-form';
import { isTimeZone, TIME_ZONE_COOKIE } from '@/lib/timezone';
import { requireViewer } from '@/lib/viewer';
import { getViewerLocale } from '@/lib/viewer-prefs';

export const metadata = { title: 'Preferences' };

/** Per-browser preferences: theme, language and time zone (cookies / localStorage; nothing to save on the server). */
export default async function PreferencesPage() {
  await requireViewer(undefined, '/account/preferences');
  const [t, tn] = await Promise.all([getTranslations('prefs'), getTranslations('nav')]);
  const stored = (await cookies()).get(TIME_ZONE_COOKIE)?.value;
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <PageHeader title={tn('preferences')} description={t('saved')} />
      <PreferencesForm
        locale={await getViewerLocale()}
        timeZone={isTimeZone(stored) ? stored : ''}
        appTimeZone={getAppTimeZone()}
      />
    </div>
  );
}
