'use client';

import { Input } from '@app/ui/components/input';
import * as Icons from '@app/ui/components/icons';
import { toast } from '@app/ui/components/toaster';
import { useState } from 'react';

const ICONS = Object.entries(Icons)
  .filter(([name]) => name.endsWith('Icon') && name !== 'IconProvider')
  .map(
    ([name, Component]) =>
      [name, Component as React.ComponentType<{ className?: string }>] as const,
  )
  .sort(([a], [b]) => a.localeCompare(b));

/** Every icon the app may use (Phosphor, light weight; pass weight="fill" for active). Click one to copy its name. */
export function IconsGallery() {
  const [query, setQuery] = useState('');
  const shown = ICONS.filter(([name]) => name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className="grid gap-4">
      <div className="max-w-xs">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${ICONS.length} icons`}
          aria-label="Search icons"
        />
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {shown.map(([name, Icon]) => (
          <li key={name}>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(name).catch(() => {
                  // Expected: clipboard blocked (not HTTPS); the name is on screen to copy by hand.
                });
                toast.success(`Copied ${name}`);
              }}
              className="flex w-full flex-col items-center gap-2 rounded-lg border border-border bg-card px-2 py-3 text-center transition-colors hover:bg-tint"
            >
              <Icon className="size-6" />
              <span className="w-full truncate text-[11px] text-muted-foreground">
                {name.replace(/Icon$/, '')}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {shown.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No icon matches. Add it to packages/ui/src/components/icons.tsx.
        </p>
      )}
    </div>
  );
}
