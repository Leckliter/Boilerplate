'use client';

import * as React from 'react';

import { cn } from '../lib/utils';
import { DesktopIcon, MoonIcon, SunIcon } from './icons';

/**
 * Light / dark / system picker. Presentational: it shows `value` and calls `onChange`; applying the
 * theme (the `dark` class, a cookie) is the app's job (apps/web has the real ThemeSwitch).
 * Built on native radio inputs, so arrow keys and screen readers work for free.
 */
type ThemeValue = 'light' | 'dark' | 'system';

/** Words the toggle shows; pass translations (all have English defaults). */
interface ThemeToggleLabels {
  /** Screen-reader legend of the group. @default "Theme" */
  legend?: string;
  light?: string;
  dark?: string;
  system?: string;
}

const DEFAULT_LABELS: Required<ThemeToggleLabels> = {
  legend: 'Theme',
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

const OPTIONS = [
  { value: 'light', Icon: SunIcon },
  { value: 'dark', Icon: MoonIcon },
  { value: 'system', Icon: DesktopIcon },
] as const;

function ThemeToggle({
  value,
  onChange,
  legend,
  labels: labelsProp,
  className,
}: {
  value: ThemeValue;
  onChange: (value: ThemeValue) => void;
  /** Same as `labels.legend`. */
  legend?: string;
  labels?: ThemeToggleLabels;
  className?: string;
}) {
  const name = React.useId();
  const labels = { ...DEFAULT_LABELS, ...labelsProp, ...(legend ? { legend } : {}) };
  return (
    <fieldset
      data-slot="theme-toggle"
      className={cn('m-0 inline-flex min-w-0 gap-0.5 rounded-lg bg-fill p-0.5', className)}
    >
      <legend className="sr-only">{labels.legend}</legend>
      {OPTIONS.map(({ value: v, Icon }) => (
        <label
          key={v}
          className={cn(
            'relative flex h-8 min-w-8 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition-colors',
            'has-checked:bg-card has-checked:text-foreground has-checked:shadow-xs',
            'has-focus-visible:ring-2 has-focus-visible:ring-ring',
          )}
        >
          <input
            type="radio"
            name={name}
            value={v}
            checked={value === v}
            onChange={() => onChange(v)}
            className="peer sr-only"
          />
          <Icon aria-hidden className="size-4" weight={value === v ? 'fill' : undefined} />
          <span className="sr-only sm:not-sr-only">{labels[v]}</span>
        </label>
      ))}
    </fieldset>
  );
}

export type { ThemeToggleLabels, ThemeValue };
export { ThemeToggle };
