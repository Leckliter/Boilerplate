import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Long-form text: docs, policies, help pages. Styles plain HTML (headings,
 * lists, tables, code, links) with the design tokens, so Markdown rendered to
 * HTML looks like the rest of the app. Pass `html` for trusted, pre-rendered
 * HTML (our own docs), or children.
 */
function Prose({
  html,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & { html?: string }) {
  return (
    <div
      data-slot="prose"
      className={cn(
        'max-w-none text-[15px] leading-7 text-foreground',
        '[&>*+*]:mt-4 [&>*:first-child]:mt-0',
        '[&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight',
        '[&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold',
        '[&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline',
        '[&_strong]:font-semibold',
        '[&_li]:mt-1 [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5',
        '[&_li::marker]:text-muted-foreground',
        '[&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[0.85em]',
        '[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-xs [&_pre]:leading-5',
        '[&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:text-sm',
        '[&_th]:border-b [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_th]:text-muted-foreground',
        '[&_td]:border-b [&_td]:border-hairline [&_td]:px-3 [&_td]:py-2 [&_td]:align-top',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground',
        '[&_hr]:border-hairline',
        className,
      )}
      {...(html !== undefined ? { dangerouslySetInnerHTML: { __html: html } } : { children })}
      {...props}
    />
  );
}

export { Prose };
