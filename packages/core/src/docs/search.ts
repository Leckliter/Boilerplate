import type { SearchContext, SearchResult } from '../actions/search/providers';
import { searchDocs } from './index';

/** Docs: the same visibility rule as docs.list (internal ones only for staff). */
export function searchDocsProvider({ actor, q, per }: SearchContext): SearchResult[] {
  return searchDocs(actor, q)
    .slice(0, per)
    .map((d) => ({
      type: 'doc' as const,
      id: d.slug,
      title: d.title,
      subtitle: d.summary || null,
      href: `/docs/${d.slug}`,
    }));
}
