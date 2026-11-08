import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Skip-to-content link for keyboard and screen-reader users. Mount it as the FIRST
 * focusable element in each layout, and give the main region `id="main-content"`
 * (and `tabIndex={-1}`). Invisible until it receives focus. Server-safe.
 *
 *   <SkipLink />
 *   <main id="main-content" tabIndex={-1}>…</main>
 */
export function SkipLink({
  href = '#main-content',
  className,
  children = 'Skip to content',
  ...props
}: Omit<React.ComponentProps<'a'>, 'href'> & { href?: string }) {
  return (
    <a
      href={href}
      data-slot="skip-link"
      className={cn(
        'sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100]',
        'focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground',
        'focus:shadow-lg focus:ring-2 focus:ring-ring focus:outline-none',
        className,
      )}
      {...props}
    >
      {children}
    </a>
  );
}
