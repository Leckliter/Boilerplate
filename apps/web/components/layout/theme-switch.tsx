'use client';

import { Button } from '@app/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@app/ui/components/dropdown-menu';
import { MoonIcon, SunIcon } from '@app/ui/components/icons';
import { useSyncExternalStore } from 'react';

import { THEME_KEY, type ThemeChoice } from '@/lib/theme';

const CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('storage', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', cb);
  };
}

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    // Expected: storage blocked (private window) — follow the system setting.
    return 'system';
  }
}

export function applyTheme(choice: ThemeChoice) {
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Expected: storage blocked — the choice lasts for this page only.
  }
  const dark =
    choice === 'dark' || (choice === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  listeners.forEach((l) => l());
}

export function useTheme(): ThemeChoice {
  return useSyncExternalStore(subscribe, read, () => 'system');
}

/** Light / dark / system, remembered in this browser. `compact` is an icon button for headers. */
export function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          compact ? (
            <Button variant="ghost" shape="square" aria-label="Theme" title="Theme" />
          ) : (
            <Button aria-label="Theme" />
          )
        }
      >
        <SunIcon className="dark:hidden" />
        <MoonIcon className="hidden dark:block" />
        {!compact && <span className="capitalize">{theme}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme} onValueChange={(v) => applyTheme(v as ThemeChoice)}>
            {CHOICES.map((c) => (
              <DropdownMenuRadioItem key={c.value} value={c.value}>
                {c.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
