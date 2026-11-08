'use client';

import {
  CommandPalette,
  type CommandGroup,
  type CommandItem,
  CommandPaletteTrigger,
  filterCommands,
  useCommandShortcut,
} from '@app/ui/components/command-palette';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import type { AppDef, NavGroup } from '@/lib/nav';
import { ADMIN_RECORD_SOURCES, useRecordSearch } from '@/lib/use-record-search';

type Ctx = { open: () => void };
const CommandMenuContext = createContext<Ctx | null>(null);

/** Open the palette from anywhere inside the shell (the rail's quick search, a button …). */
export function useCommandMenu() {
  return useContext(CommandMenuContext);
}

/**
 * ⌘K: jump to any page in the nav, switch app, and (in admin) find records. Mounted once by the shell. Pages
 * come from lib/nav.ts, records from `ADMIN_RECORD_SOURCES` in lib/use-record-search.ts.
 */
export function CommandMenuProvider({
  groups,
  apps,
  searchRecords,
  children,
}: {
  groups: NavGroup[];
  apps: AppDef[];
  /** Search records too (admin viewers). */
  searchRecords: boolean;
  children: ReactNode;
}) {
  const t = useTranslations('shell');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const show = useCallback(() => setOpen(true), []);
  useCommandShortcut(show);

  const pages = useMemo<CommandItem[]>(
    () =>
      groups.flatMap((g) =>
        g.items.map((i) => ({
          id: i.href,
          label: i.label,
          description: g.label || undefined,
          hint: t('pages'),
          icon: <i.icon />,
          keywords: [g.label],
        })),
      ),
    [groups, t],
  );
  const switchApps = useMemo<CommandItem[]>(
    () =>
      apps.map((a) => ({
        id: a.href,
        label: a.label,
        hint: t('apps'),
        icon: <a.icon />,
        keywords: ['app', 'switch', 'go'],
      })),
    [apps, t],
  );
  const records = useRecordSearch(query, ADMIN_RECORD_SOURCES, searchRecords && open);

  const palette: CommandGroup[] = [
    { label: t('pages'), items: filterCommands(pages, query) },
    { label: t('apps'), items: filterCommands(switchApps, query) },
    ...records.groups,
  ];

  return (
    <CommandMenuContext.Provider value={{ open: show }}>
      {children}
      <CommandPalette
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery('');
        }}
        query={query}
        onQueryChange={setQuery}
        groups={palette}
        loading={records.loading}
        placeholder={t('search')}
        onSelect={(item) => {
          setOpen(false);
          setQuery('');
          router.push(item.id);
        }}
      />
    </CommandMenuContext.Provider>
  );
}

/** The search box in the header or rail. Opens the palette. */
export function CommandMenuTrigger({ className }: { className?: string }) {
  const t = useTranslations('shell');
  const menu = useCommandMenu();
  return (
    <CommandPaletteTrigger
      label={t('quickSearch')}
      className={className}
      onClick={() => menu?.open()}
      aria-haspopup="dialog"
    />
  );
}
