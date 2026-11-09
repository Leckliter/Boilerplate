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

import type { AppDef, CreateCommand, NavGroup } from '@/lib/nav';
import { type SearchGroupType, useGlobalSearch } from '@/lib/use-record-search';

type Ctx = { open: () => void };
const CommandMenuContext = createContext<Ctx | null>(null);

/** Open the palette from anywhere inside the shell (the rail's quick search, a button …). */
export function useCommandMenu() {
  return useContext(CommandMenuContext);
}

/**
 * ⌘K: jump to any page in the nav, switch app, start something ("New user" …) and find records, docs and
 * errors. Mounted once by the shell. Pages and create commands come from lib/nav.ts; results come from the
 * `search.query` action (it only returns what the person may see; see lib/use-record-search.ts).
 */
export function CommandMenuProvider({
  groups,
  apps,
  createCommands = [],
  searchRecords = true,
  children,
}: {
  groups: NavGroup[];
  apps: AppDef[];
  /** "Create …" commands this person may use (already permission-filtered and translated). */
  createCommands?: CreateCommand[];
  /** Search records, docs and errors too (every signed-in person; the action filters). */
  searchRecords?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations('shell');
  const tp = useTranslations('palette');
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
  const creates = useMemo<CommandItem[]>(
    () =>
      createCommands.map((c) => ({
        id: c.href,
        label: c.label,
        hint: tp('create'),
        icon: <c.icon />,
        keywords: ['new', 'add', 'create'],
      })),
    [createCommands, tp],
  );
  const groupLabels = useMemo<Record<SearchGroupType, string>>(
    () => ({
      contact: tp('groups.contact'),
      tag: tp('groups.tag'),
      inquiry: tp('groups.inquiry'),
      automation: tp('groups.automation'),
      error: tp('groups.error'),
      activity: tp('groups.activity'),
      doc: tp('groups.doc'),
    }),
    [tp],
  );
  const records = useGlobalSearch(query, searchRecords && open, groupLabels);

  const palette: CommandGroup[] = [
    { label: tp('create'), items: filterCommands(creates, query) },
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
        emptyText={tp('empty')}
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
