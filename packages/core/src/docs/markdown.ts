import type { Block, Inline } from './types';

/**
 * A small, safe Markdown renderer for the docs. It understands what docs need and nothing else:
 * headings (## ### ####), paragraphs, bullet and numbered lists, fenced code, blockquotes, tables,
 * horizontal rules, and inline **bold**, *italic*, `code` and [links](https://…). Anything else is
 * plain text. HTML in a doc is never interpreted — `<script>` stays the literal characters — and a
 * link is only kept when it is http(s), mailto, a site path or an anchor, so `javascript:` links
 * become plain text.
 */
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  const used = new Map<string, number>();
  let i = 0;

  const isBlank = (l: string) => l.trim() === '';
  const startsBlockAt = (idx: number) => {
    const l = lines[idx]!;
    return (
      /^(#{2,4})\s/.test(l) ||
      /^```/.test(l) ||
      /^\s*([-*+])\s+/.test(l) ||
      /^\s*\d+[.)]\s+/.test(l) ||
      /^>\s?/.test(l) ||
      /^(-{3,}|\*{3,})\s*$/.test(l) ||
      isTableStart(lines, idx)
    );
  };

  while (i < lines.length) {
    const line = lines[i]!;
    if (isBlank(line)) {
      i++;
      continue;
    }
    const fence = /^```\s*([\w-]*)\s*$/.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i]!)) body.push(lines[i++]!);
      i++; // closing fence
      blocks.push({ t: 'code', lang: fence[1] || null, text: body.join('\n') });
      continue;
    }
    const heading = /^(#{2,4})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      const text = heading[2]!;
      const base = slugify(text) || 'section';
      const n = (used.get(base) ?? 0) + 1;
      used.set(base, n);
      blocks.push({
        t: 'h',
        level: heading[1]!.length as 2 | 3 | 4,
        id: n === 1 ? base : `${base}-${n}`,
        c: parseInline(text),
      });
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ t: 'hr' });
      i++;
      continue;
    }
    if (isTableStart(lines, i)) {
      const head = splitRow(lines[i]!).map(parseInline);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && /\|/.test(lines[i]!) && !isBlank(lines[i]!)) {
        rows.push(splitRow(lines[i++]!).map(parseInline));
      }
      blocks.push({ t: 'table', head, rows });
      continue;
    }
    const bullet = /^\s*([-*+])\s+/.test(line);
    const numbered = /^\s*\d+[.)]\s+/.test(line);
    if (bullet || numbered) {
      const marker = bullet ? /^\s*[-*+]\s+(.*)$/ : /^\s*\d+[.)]\s+(.*)$/;
      const items: Inline[][] = [];
      while (i < lines.length && marker.test(lines[i]!)) {
        let text = marker.exec(lines[i]!)![1]!;
        i++;
        // A continuation line (indented, not a new item) belongs to the item.
        while (
          i < lines.length &&
          /^\s{2,}\S/.test(lines[i]!) &&
          !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]!)
        ) {
          text += ` ${lines[i]!.trim()}`;
          i++;
        }
        items.push(parseInline(text));
      }
      blocks.push({ t: bullet ? 'ul' : 'ol', items });
      continue;
    }
    if (/^>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]!))
        body.push(lines[i++]!.replace(/^>\s?/, ''));
      blocks.push({ t: 'quote', c: parseInline(body.join(' ')) });
      continue;
    }
    // Paragraph: lines up to a blank line or the start of another block.
    const para: string[] = [line.trim()];
    i++;
    while (i < lines.length && !isBlank(lines[i]!) && !startsBlockAt(i)) {
      para.push(lines[i++]!.trim());
    }
    blocks.push({ t: 'p', c: parseInline(para.join(' ')) });
  }
  return blocks;
}

const isTableStart = (lines: string[], i: number) =>
  i >= 0 &&
  /\|/.test(lines[i] ?? '') &&
  /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1] ?? '');

const splitRow = (row: string) =>
  row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, '|'));

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[`*_]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Links we keep. Everything else (javascript:, data:, …) is shown as text. */
export const isSafeHref = (href: string) => /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(href.trim());

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer) out.push(buffer);
    buffer = '';
  };
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    let m: RegExpExecArray | null;
    if (rest[0] === '\\' && /[\\`*_[\]()|#>-]/.test(rest[1] ?? '')) {
      buffer += rest[1];
      i += 2;
    } else if ((m = /^`([^`]+)`/.exec(rest))) {
      flush();
      out.push({ t: 'code', c: [m[1]!] });
      i += m[0].length;
    } else if ((m = /^\*\*(.+?)\*\*/.exec(rest)) || (m = /^__(.+?)__/.exec(rest))) {
      flush();
      out.push({ t: 'strong', c: parseInline(m[1]!) });
      i += m[0].length;
    } else if (
      (m = /^\*([^*\s][^*]*?)\*/.exec(rest)) ||
      (m = /^_([^_\s][^_]*?)_(?![\w])/.exec(rest))
    ) {
      flush();
      out.push({ t: 'em', c: parseInline(m[1]!) });
      i += m[0].length;
    } else if ((m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest))) {
      flush();
      const label = parseInline(m[1]!);
      if (isSafeHref(m[2]!)) out.push({ t: 'link', href: m[2]!, c: label });
      else out.push(...label);
      i += m[0].length;
    } else {
      buffer += text[i];
      i++;
    }
  }
  flush();
  return out;
}

/** Plain text of some inline content (search, page descriptions). */
export function inlineText(inline: Inline[]): string {
  return inline.map((n) => (typeof n === 'string' ? n : inlineText(n.c))).join('');
}
