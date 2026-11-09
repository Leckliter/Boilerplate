import type en from '../messages/en.json';

import type { Locale } from '@/i18n/locales';

/**
 * Typed translations: `t('bell.title')`-style keys are checked against messages/en.json, so a typo or a
 * deleted key fails `pnpm typecheck`. messages/keys.test.ts checks es.json has exactly the same keys.
 */
declare module 'next-intl' {
  interface AppConfig {
    Messages: typeof en;
    Locale: Locale;
  }
}
