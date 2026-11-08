'use client';

import { NativeSelect } from '@app/ui/components/input';
import { useRouter } from 'next/navigation';

import { LANGUAGE_NAMES, type Locale } from '@/i18n/locales';

/** Switches the language (a `locale` cookie read by i18n/request.ts) and reloads the page's text. */
export function LanguageSelector({ value }: { value: Locale }) {
  const router = useRouter();
  return (
    <NativeSelect
      aria-label="Language"
      value={value}
      onChange={(e) => {
        document.cookie = `locale=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
      className="max-w-56"
    >
      {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
        <option key={code} value={code}>
          {name}
        </option>
      ))}
    </NativeSelect>
  );
}
