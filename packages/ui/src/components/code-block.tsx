import type * as React from 'react';

import { cn } from '../lib/utils';
import { CopyButton } from './copy-button';

/**
 * Preformatted text: JSON, a stack trace, a URL to paste somewhere. Scrolls
 * wraps long lines (never pushes the page sideways). `copy` adds a Copy button.
 */
function CodeBlock({
  children,
  copy,
  className,
  ...props
}: React.ComponentProps<'pre'> & { copy?: string }) {
  return (
    <div data-slot="code-block" className="relative min-w-0">
      <pre
        className={cn(
          'max-h-96 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap',
          copy && 'pr-24',
          className,
        )}
        {...props}
      >
        {children}
      </pre>
      {copy && (
        <span className="absolute top-1.5 right-1.5">
          <CopyButton value={copy} size="xs" variant="secondary" />
        </span>
      )}
    </div>
  );
}

export { CodeBlock };
