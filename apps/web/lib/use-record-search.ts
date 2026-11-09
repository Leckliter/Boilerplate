'use client';

import type { CommandItem } from '@app/ui/components/command-palette';
import { useEffect, useState } from 'react';

import { invokeAction } from './invoke';

type Hit = {
  type: 'contact' | 'tag' | 'doc' | 'automation' | 'error' | 'activity' | 'inquiry';
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
};

/** Groups in the order the palette shows them; `search.query` already returns only what the person may see. */
export const SEARCH_GROUP_TYPES: Hit['type'][] = [
  'contact',
  'tag',
  'inquiry',
  'automation',
  'error',
  'activity',
  'doc',
];
export type SearchGroupType = Hit['type'];

type Groups = { label: string; items: CommandItem[] }[];

/**
 * Debounced ⌘K search over EVERYTHING the person may see: one `search.query` call (the action does the
 * permission filtering, so a customer only gets docs and an admin also gets records), grouped by kind.
 * An item's `id` is the URL it opens. Search is best-effort: a failure shows no results, never an error.
 */
export function useGlobalSearch(
  query: string,
  enabled: boolean,
  /** The heading of each group (translated by the caller). */
  labels: Record<SearchGroupType, string>,
) {
  const [state, setState] = useState<{ query: string; groups: Groups }>({ query: '', groups: [] });
  const q = query.trim();
  const active = enabled && q.length >= 2;
  useEffect(() => {
    if (!active) return;
    let live = true;
    const timer = setTimeout(async () => {
      let groups: Groups = [];
      try {
        const res = await invokeAction('search.query', { q, limit: 24 });
        if (res.ok) {
          const hits = (res.data as { results: Hit[] }).results;
          groups = SEARCH_GROUP_TYPES.map((type) => ({
            label: labels[type],
            items: hits
              .filter((h) => h.type === type)
              .map((h) => ({
                id: h.href,
                label: h.title,
                description: h.subtitle,
                hint: labels[type],
              })),
          }));
        }
      } catch {
        // Expected: offline or a stale tab. The palette still works for pages; just no records.
      }
      if (live) setState({ query: q, groups });
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // `labels` is a stable object from the caller's translations.
  }, [active, q, labels]);
  return {
    groups: active && state.query === q ? state.groups : [],
    loading: active && state.query !== q,
  };
}
