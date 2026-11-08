import { z } from 'zod';

import { DOC_SECTIONS, findDoc, searchDocs } from '../../docs';
import { ActionError, defineAction } from '../define';

export const listDocs = defineAction({
  name: 'docs.list',
  title: 'List docs',
  description:
    'The in-app docs: short how-tos (public) and, for staff, runbooks and rules (internal: how to use Admin → Errors, ' +
    'brand rules …). Returns only the docs the caller may read. Search with `query`; read one with docs.get. ' +
    'Check here before guessing how something works or how the brand should look.',
  audience: 'public',
  mutates: false,
  returns: '{ sections: [{ id, title }], docs: [{ slug, section, title, summary, audience }] }',
  input: z.object({
    query: z.string().max(200).optional().describe('Words to search for (all must match).'),
    section: z.string().max(50).optional().describe('Only docs in this section id.'),
  }),
  async run({ input, actor }) {
    const docs = searchDocs(actor, input.query ?? '').filter(
      (d) => !input.section || d.section === input.section,
    );
    return {
      sections: DOC_SECTIONS.map(({ id, title }) => ({ id, title })),
      docs: docs.map(({ slug, section, title, summary, audience }) => ({
        slug,
        section,
        title,
        summary,
        audience,
      })),
    };
  },
});

export const getDoc = defineAction({
  name: 'docs.get',
  title: 'Read a doc',
  description:
    'One doc as Markdown, by slug (from docs.list, e.g. `start/getting-started`). Internal docs are only ' +
    'returned to staff; for anyone else they are "not found".',
  audience: 'public',
  mutates: false,
  returns: '{ slug, section, title, summary, audience, url, markdown }',
  input: z.object({
    slug: z
      .string()
      .max(120)
      .describe(
        'The doc slug, e.g. `start/getting-started` (also accepts `/docs/start/getting-started`).',
      ),
  }),
  async run({ input, actor }) {
    const slug = input.slug.replace(/^\/?(docs\/)?/, '').replace(/\/$/, '');
    const doc = findDoc(actor, slug);
    if (!doc) throw new ActionError('not_found', `No doc "${slug}". Use docs.list to find one.`);
    const { section, title, summary, audience, markdown } = doc;
    return { slug, section, title, summary, audience, url: `/docs/${slug}`, markdown };
  },
});
