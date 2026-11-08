import type { Block, Inline } from '@app/core/docs';
import { Prose } from '@app/ui/components/prose';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Renders a doc's blocks (built by `pnpm docs:build`, see packages/core/src/docs/markdown.ts).
 * There is no raw HTML anywhere: every string is a React text child, so it is escaped, and links
 * were already limited to http(s), mailto, site paths and anchors when the doc was built.
 */
export function DocBody({ blocks }: { blocks: Block[] }) {
  return (
    <Prose>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </Prose>
  );
}

function BlockView({ block: b }: { block: Block }): ReactNode {
  switch (b.t) {
    case 'p':
      return <p>{inline(b.c)}</p>;
    case 'h': {
      const Tag = `h${b.level}` as 'h2' | 'h3' | 'h4';
      return (
        <Tag id={b.id} className="scroll-mt-20">
          {inline(b.c)}
        </Tag>
      );
    }
    case 'ul':
      return (
        <ul>
          {b.items.map((it, i) => (
            <li key={i}>{inline(it)}</li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol>
          {b.items.map((it, i) => (
            <li key={i}>{inline(it)}</li>
          ))}
        </ol>
      );
    case 'code':
      return (
        <pre>
          <code>{b.text}</code>
        </pre>
      );
    case 'quote':
      return <blockquote>{inline(b.c)}</blockquote>;
    case 'hr':
      return <hr />;
    case 'table':
      return (
        <table>
          <thead>
            <tr>
              {b.head.map((h, i) => (
                <th key={i}>{inline(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{inline(c)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
  }
}

function inline(nodes: Inline[]): ReactNode {
  return nodes.map((n, i) => {
    if (typeof n === 'string') return n;
    switch (n.t) {
      case 'strong':
        return <strong key={i}>{inline(n.c)}</strong>;
      case 'em':
        return <em key={i}>{inline(n.c)}</em>;
      case 'code':
        return <code key={i}>{inline(n.c)}</code>;
      case 'link':
        return /^\/(?!\/)/.test(n.href) ? (
          <Link key={i} href={n.href}>
            {inline(n.c)}
          </Link>
        ) : (
          <a
            key={i}
            href={n.href}
            rel="noopener noreferrer"
            target={n.href.startsWith('http') ? '_blank' : undefined}
          >
            {inline(n.c)}
          </a>
        );
    }
  });
}
