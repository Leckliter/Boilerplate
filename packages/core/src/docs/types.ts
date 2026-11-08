/**
 * Who may read a doc. Set in each doc's front matter (`audience: public` or `audience: internal`);
 * `canReadDoc` (./index.ts) decides who sees what.
 * - `public`   — everyone, signed in or not (customers, visitors, search engines)
 * - `internal` — staff only (anyone with the `docs.internal` permission)
 */
export type DocAudience = 'public' | 'internal';

/** A run of text inside a block. Plain strings are text; everything else is formatting. */
export type Inline =
  string | { t: 'strong' | 'em' | 'code'; c: Inline[] } | { t: 'link'; href: string; c: Inline[] };

/**
 * A doc, rendered by `pnpm docs:build` into blocks the web app maps to components. There is no raw
 * HTML anywhere: the Markdown parser (./markdown.ts) only produces these shapes, so a doc can never
 * inject markup or script.
 */
export type Block =
  | { t: 'p'; c: Inline[] }
  | { t: 'h'; level: 2 | 3 | 4; id: string; c: Inline[] }
  | { t: 'ul' | 'ol'; items: Inline[][] }
  | { t: 'code'; lang: string | null; text: string }
  | { t: 'quote'; c: Inline[] }
  | { t: 'hr' }
  | { t: 'table'; head: Inline[][]; rows: Inline[][][] };

export type Doc = {
  /** `<section>/<file name>`, e.g. `start/getting-started`. The URL is `/docs/<slug>`. */
  slug: string;
  section: string;
  title: string;
  /** One sentence: what the reader will learn. Shown in lists and search results. */
  summary: string;
  audience: DocAudience;
  /** Position inside its section (lowest first). */
  order: number;
  /** The doc as written (for AI readers and search). */
  markdown: string;
  /** The doc rendered for the website. */
  blocks: Block[];
  words: number;
};

export type DocSection = {
  /** A folder in apps/web/content/docs. */
  id: string;
  title: string;
  description: string;
};
