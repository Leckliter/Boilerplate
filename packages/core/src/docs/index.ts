import type { Actor } from '../access';
import { DOCS } from './docs.generated';
import { DOC_SECTIONS } from './sections';
import type { Doc, DocSection } from './types';

export * from './types';
export { DOC_SECTIONS } from './sections';
export { inlineText, isSafeHref, parseMarkdown, slugify } from './markdown';

/**
 * THE rule for who reads what. Public docs: everyone. Internal docs: only actors with
 * `docs.internal` (every staff role). Pages, REST and MCP all go through this, so an internal doc
 * can't leak through one door but not another.
 */
export function canReadDoc(actor: Actor, doc: Pick<Doc, 'audience'>): boolean {
  return doc.audience === 'public' || actor.permissions.has('docs.internal');
}

/** Every doc this actor may read, in section then doc order. */
export function readableDocs(actor: Actor, all: readonly Doc[] = DOCS): Doc[] {
  const sectionIndex = new Map(DOC_SECTIONS.map((s, i) => [s.id, i]));
  return all
    .filter((d) => canReadDoc(actor, d))
    .sort(
      (a, b) =>
        (sectionIndex.get(a.section) ?? 99) - (sectionIndex.get(b.section) ?? 99) ||
        a.order - b.order ||
        a.title.localeCompare(b.title),
    );
}

/** The sections this actor can see, each with its readable docs. */
export function docTree(
  actor: Actor,
  all: readonly Doc[] = DOCS,
): (DocSection & { docs: Doc[] })[] {
  const docs = readableDocs(actor, all);
  return DOC_SECTIONS.map((s) => ({ ...s, docs: docs.filter((d) => d.section === s.id) })).filter(
    (s) => s.docs.length > 0,
  );
}

/** One doc by slug — or null when it doesn't exist OR the actor may not read it (same answer, so internal docs stay secret). */
export function findDoc(actor: Actor, slug: string, all: readonly Doc[] = DOCS): Doc | null {
  const doc = all.find((d) => d.slug === slug);
  return doc && canReadDoc(actor, doc) ? doc : null;
}

/** Docs whose title, summary or text contain every word of the query (title matches first). */
export function searchDocs(actor: Actor, query: string, all: readonly Doc[] = DOCS): Doc[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const readable = readableDocs(actor, all);
  if (!terms.length) return readable;
  return readable
    .map((d) => {
      const head = `${d.title} ${d.summary}`.toLowerCase();
      const body = d.markdown.toLowerCase();
      if (!terms.every((t) => head.includes(t) || body.includes(t))) return null;
      return { d, score: terms.filter((t) => head.includes(t)).length };
    })
    .filter((x) => x !== null)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.d);
}
