'use client';

import * as React from 'react';

import { cn } from '../lib/utils';
import { TranslateIcon } from './icons';
import { NativeSelect } from './input';

/**
 * Language picker. Presentational: `languages` in, `onChange` out; switching the app's locale is
 * the caller's job. A native <select> so it is accessible and works with phone pickers.
 */
type LanguageOption = { code: string; label: string };

function LanguageSelect({
  value,
  onChange,
  languages,
  label = 'Language',
  className,
}: {
  value: string;
  onChange: (code: string) => void;
  languages: LanguageOption[];
  label?: string;
  className?: string;
}) {
  const id = React.useId();
  return (
    <div data-slot="language-select" className={cn('relative inline-flex min-w-0', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <TranslateIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 z-1 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <NativeSelect
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-8"
      >
        {languages.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

export type { LanguageOption };
export { LanguageSelect };
