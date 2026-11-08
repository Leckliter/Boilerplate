'use client';

import type { CommandItem } from '@app/ui/components/command-palette';
import { useEffect, useState } from 'react';

import { invokeAction } from './invoke';

/**
 * Where ⌘K looks for RECORDS (people, projects …), next to the pages. Add a source: one entry here that
 * calls a LIST action (the action checks permissions; nobody sees a record they may not read) and maps
 * rows to palette items. An item's `id` is the URL it opens.
 */
export type RecordSource = {
  /** Group heading in the palette. */
  label: string;
  /** Called with the typed text (at least 2 characters). Return no items on failure: it is only search. */
  search: (query: string) => Promise<CommandItem[]>;
};

type ContactRow = { id: string; displayName: string; email: string | null; companyName: string | null };

export const ADMIN_RECORD_SOURCES: RecordSource[] = [
  {
    label: 'Users',
    async search(query) {
      const res = await invokeAction('contacts.list', { search: query, limit: 6 });
      if (!res.ok) return [];
      const { contacts } = res.data as { contacts: ContactRow[] };
      return contacts.map((c) => ({
        id: `/admin/users/${c.id}`,
        label: c.displayName,
        description: c.email ?? c.companyName,
        hint: 'User',
      }));
    },
  },
];

/** Debounced record search for the palette. `sources` is empty for people who cannot search records. */
export function useRecordSearch(query: string, sources: RecordSource[], enabled: boolean) {
  const [state, setState] = useState<{ query: string; groups: { label: string; items: CommandItem[] }[] }>({
    query: '',
    groups: [],
  });
  const q = query.trim();
  const active = enabled && q.length >= 2 && sources.length > 0;
  useEffect(() => {
    if (!active) return;
    let live = true;
    const timer = setTimeout(async () => {
      const groups = await Promise.all(
        sources.map(async (s) => ({ label: s.label, items: await s.search(q).catch(() => {
            // Expected: search is best-effort; a failing source just shows no results.
            return [];
          }) })),
      );
      if (live) setState({ query: q, groups });
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [active, q, sources]);
  return {
    groups: active && state.query === q ? state.groups : [],
    loading: active && state.query !== q,
  };
}
