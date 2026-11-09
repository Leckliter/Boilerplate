import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * PageActions: the buttons of a page or section, wrapping instead of overflowing on a phone.
 * MobileActionBar: the same actions pinned to the bottom of the screen on phones (the thumb zone),
 * inline from `md` up. Put it last in the page; it reserves its own space so nothing hides under it.
 *
 *   <MobileActionBar><Button>Cancel</Button><Button variant="primary">Save</Button></MobileActionBar>
 */
function PageActions({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="page-actions"
      className={cn('flex flex-wrap items-center gap-2', className)}
      {...props}
    />
  );
}

function MobileActionBar({
  className,
  children,
  'aria-label': ariaLabel = 'Actions',
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <>
      {/* Spacer so content scrolls clear of the fixed bar on phones. */}
      <div aria-hidden className="h-20 md:hidden" />
      <div
        data-slot="mobile-action-bar"
        role="group"
        aria-label={ariaLabel}
        className={cn(
          'fixed inset-x-0 bottom-0 z-30 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-card/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur',
          'md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:pb-0 md:backdrop-blur-none',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </>
  );
}

export { MobileActionBar, PageActions };
