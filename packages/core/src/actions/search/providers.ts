import type { Tx } from '@app/db';

import type { Actor, Permission } from '../../access';

/** One hit in the ⌘K palette. `type` is the kind: core ones below, plus whatever a module's provider returns. */
export type SearchResult = {
  type: 'contact' | 'tag' | 'doc' | 'automation' | 'error' | 'activity' | 'inquiry' | (string & {});
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
};

/** What a provider gets: the query (already trimmed), its LIKE pattern, and the caller. */
export type SearchContext = {
  tx: Tx;
  actor: Actor;
  /** The trimmed query as typed. */
  q: string;
  /** `%q%` with LIKE wildcards escaped, for `ilike`. */
  like: string;
  /** The digits in the query (for phone numbers). */
  digits: string;
  /** How many hits each provider should return at most. */
  per: number;
  /** Whether the caller holds a permission. A provider returns nothing for kinds the caller may not see. */
  can: (permission: Permission) => boolean;
};

export type SearchProvider = (ctx: SearchContext) => Promise<SearchResult[]> | SearchResult[];

type Entry = { name: string; order: number; run: SearchProvider };
const providers = new Map<string, Entry>();

/**
 * Add a kind of result to `search.query` (the ⌘K palette). Core registers contacts/tags, errors and
 * activity; optional modules register their own in `register.ts` (automations, docs, inquiries), so
 * deleting a module folder removes its results and nothing else imports it. `order` fixes where the
 * kind appears (lower first; ties by registration). A duplicate name is a bug and throws.
 */
export function registerSearchProvider(
  name: string,
  run: SearchProvider,
  opts: { order?: number } = {},
) {
  if (providers.has(name)) throw new Error(`Duplicate search provider: ${name}`);
  providers.set(name, { name, order: opts.order ?? 100, run });
}

/** Registered providers, in result order. */
export function listSearchProviders(): readonly Entry[] {
  return [...providers.values()].sort((a, b) => a.order - b.order);
}
