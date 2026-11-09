import { beforeAll, describe, expect, it } from 'vitest';

import { guestActor } from '../src/access';
import { callAction } from '../src/actions';
import { getDoc, listDocs } from '../src/actions/docs';
import { canReadDoc, docTree, findDoc, searchDocs } from '../src/docs';
import { inlineText, parseMarkdown } from '../src/docs/markdown';
import type { Doc } from '../src/docs/types';
import { assertLocalDatabase, makeActor } from './setup';

beforeAll(assertLocalDatabase);

const doc = (slug: string, audience: Doc['audience'], over: Partial<Doc> = {}): Doc => ({
  slug,
  section: slug.split('/')[0]!,
  title: slug,
  summary: 's',
  audience,
  order: 1,
  markdown: 'secret words',
  blocks: [],
  words: 2,
  ...over,
});

describe('markdown renderer', () => {
  it('renders the supported blocks and inline formatting', () => {
    const blocks = parseMarkdown(
      '## Title\n\nSome **bold**, *em* and `code` with a [link](/docs/x).\n\n- one\n- two\n\n1. a\n2. b\n\n```ts\nconst a = 1;\n```\n\n> quote\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n---\n',
    );
    expect(blocks.map((b) => b.t)).toEqual(['h', 'p', 'ul', 'ol', 'code', 'quote', 'table', 'hr']);
    expect(blocks[0]).toMatchObject({ level: 2, id: 'title' });
    expect(blocks[1]).toMatchObject({
      c: expect.arrayContaining([
        { t: 'strong', c: ['bold'] },
        { t: 'link', href: '/docs/x', c: ['link'] },
      ]),
    });
    expect(blocks[4]).toMatchObject({ lang: 'ts', text: 'const a = 1;' });
    expect(blocks[6]).toMatchObject({ head: [['A'], ['B']], rows: [[['1'], ['2']]] });
  });

  it('never produces raw HTML or unsafe links', () => {
    const [p] = parseMarkdown(
      '<script>alert(1)</script> [x](javascript:alert(1)) [ok](https://a.test) <b>hi</b>',
    );
    const text = inlineText((p as unknown as { c: never[] }).c);
    expect(text).toContain('<script>alert(1)</script>'); // literal text, rendered escaped by React
    expect(JSON.stringify(p)).not.toContain('javascript:');
    expect(JSON.stringify(p)).toContain('https://a.test');
  });

  it('gives repeated headings unique ids', () => {
    const ids = parseMarkdown('## Same\n\n## Same').map((b) => (b.t === 'h' ? b.id : ''));
    expect(ids).toEqual(['same', 'same-2']);
  });
});

describe('who reads what', () => {
  const docs = [doc('start/a', 'public'), doc('internal/b', 'internal')];

  it('public docs for everyone; internal only with docs.internal', async () => {
    const staff = await makeActor(['staff']);
    const customer = await makeActor([]);
    for (const [who, count] of [
      [guestActor(), 1],
      [customer, 1],
      [staff, 2],
    ] as const) {
      expect(searchDocs(who, '', docs)).toHaveLength(count);
      expect(canReadDoc(who, docs[1]!)).toBe(count === 2);
    }
    expect(findDoc(customer, 'internal/b', docs)).toBeNull();
    expect(findDoc(customer, 'missing', docs)).toBeNull();
    expect(findDoc(staff, 'internal/b', docs)?.slug).toBe('internal/b');
    expect(docTree(guestActor(), docs).map((s) => s.id)).toEqual(['start']);
    expect(searchDocs(staff, 'secret', docs)).toHaveLength(2);
    expect(searchDocs(staff, 'nothing-here', docs)).toHaveLength(0);
  });
});

describe('docs.list / docs.get (the seeded docs)', () => {
  it('lists public docs to a guest and hides the internal ones; staff see them', async () => {
    const guest = await callAction(listDocs, {}, guestActor());
    expect(guest.ok && guest.data.docs.map((d) => d.slug)).toContain('start/getting-started');
    expect(guest.ok && guest.data.docs.every((d) => d.audience === 'public')).toBe(true);
    const staff = await callAction(listDocs, { section: 'internal' }, await makeActor(['staff']));
    expect(staff.ok && staff.data.docs.map((d) => d.slug)).toEqual(
      expect.arrayContaining(['internal/runbook-errors', 'internal/brand-rules']),
    );
  });

  it('reads a doc; an internal one is "not found" for everyone without docs.internal', async () => {
    const got = await callAction(getDoc, { slug: '/docs/start/getting-started' }, guestActor());
    expect(got).toMatchObject({
      ok: true,
      data: { slug: 'start/getting-started', url: '/docs/start/getting-started' },
    });
    expect(
      await callAction(getDoc, { slug: 'internal/runbook-errors' }, guestActor()),
    ).toMatchObject({ ok: false, error: { code: 'not_found' } });
    expect(
      await callAction(getDoc, { slug: 'internal/runbook-errors' }, await makeActor([])),
    ).toMatchObject({ ok: false, error: { code: 'not_found' } });
    expect(
      await callAction(getDoc, { slug: 'internal/runbook-errors' }, await makeActor(['staff'])),
    ).toMatchObject({ ok: true });
  });
});
