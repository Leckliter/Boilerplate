'use client';

import { type ComponentPropsWithoutRef, forwardRef } from 'react';
import { ScrollArea as ScrollAreaBase } from '@base-ui/react/scroll-area';

import { cn } from '../../lib/utils';
import { SkeletonLine } from './shared';

// ============================================================================
// Sidebar Header
// ============================================================================

/**
 * Top section of the sidebar. Typically contains a logo, title, and action button.
 *
 * @example
 * ```tsx
 * <Sidebar.Header>
 *   <CloudflareLogo />
 *   <span>Design Engineering</span>
 *   <Button shape="square" icon={CaretUpDownIcon} aria-label="Switch" />
 * </Sidebar.Header>
 * ```
 */
export const SidebarHeader = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-sidebar="header"
      className={cn(
        'flex h-[58px] shrink-0 items-center gap-1 border-b border-border',
        'overflow-hidden px-3',
        className,
      )}
      {...props}
    />
  ),
);

SidebarHeader.displayName = 'Sidebar.Header';

// ============================================================================
// Sidebar Content
// ============================================================================

/**
 * Scrollable middle section of the sidebar. Contains nav groups and menus.
 *
 * @example
 * ```tsx
 * <Sidebar.Content>
 *   <Sidebar.Group>...</Sidebar.Group>
 * </Sidebar.Content>
 * ```
 */
export const SidebarContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  ({ className, children, ...props }, ref) => {
    return (
      <ScrollAreaBase.Root
        ref={ref}
        data-sidebar="content"
        className={cn('relative min-w-0 flex-1 overflow-hidden', className)}
        {...props}
      >
        <ScrollAreaBase.Viewport
          tabIndex={-1}
          data-sidebar="viewport"
          className={cn(
            'h-full px-[11px] py-3 group-not-data-[state=collapsed]/sidebar:px-3.5',
            'transition-[padding] duration-(--sidebar-animation-duration)',
            'overflow-x-hidden!',
            // Hide the native scrollbar with CSS rather than relying on
            // the <style> Base UI adds to <head>, which head-swapping client
            // routers and strict CSPs can drop.
            '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            // Scroll fade via CSS mask driven by Base UI overflow CSS variables
            '[mask-image:linear-gradient(to_bottom,transparent_0,black_min(24px,var(--scroll-area-overflow-y-start,24px)),black_calc(100%-min(24px,var(--scroll-area-overflow-y-end,24px))),transparent_100%)]',
          )}
        >
          <ScrollAreaBase.Content className="flex min-w-0! flex-col">
            {children}
          </ScrollAreaBase.Content>
        </ScrollAreaBase.Viewport>
        <ScrollAreaBase.Scrollbar
          orientation="vertical"
          className={cn(
            'flex w-1.5 touch-none p-px select-none',
            'opacity-0 transition-opacity duration-150',
            'data-[hovering]:opacity-100 data-[scrolling]:opacity-100',
            'group-data-[state=collapsed]/sidebar:hidden',
          )}
        >
          <ScrollAreaBase.Thumb className="flex-1 rounded-full bg-border" />
        </ScrollAreaBase.Scrollbar>
      </ScrollAreaBase.Root>
    );
  },
);

SidebarContent.displayName = 'Sidebar.Content';

// ============================================================================
// Sidebar Footer
// ============================================================================

/**
 * Bottom-pinned section of the sidebar. Rendered outside the peek zone
 * so hovering the footer doesn't trigger a peek. Tracks sidebar width
 * to stay aligned with the content container.
 *
 * @example
 * ```tsx
 * <Sidebar.Footer>
 *   <Sidebar.Trigger />
 * </Sidebar.Footer>
 * ```
 */
export const SidebarFooter = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-sidebar="footer"
      className={cn(
        'flex h-12 shrink-0 items-center gap-4 overflow-hidden border-t border-border whitespace-nowrap',
        'px-[11px] group-not-data-[state=collapsed]/sidebar:px-4',
        'bg-(--sidebar-bg)',
        'w-(--sidebar-width)',
        'transition-[width,padding] duration-(--sidebar-animation-duration) ease-(--sidebar-easing)',
        'motion-reduce:transition-none',
        'sticky bottom-0',
        'bg-clip-padding group-data-[state=collapsed]/sidebar:w-(--sidebar-width-icon)',
        'group-data-[state=collapsed]/sidebar:border-r group-data-[state=collapsed]/sidebar:border-border',
        className,
      )}
      {...props}
    />
  ),
);

SidebarFooter.displayName = 'Sidebar.Footer';

// ============================================================================
// Sidebar Loading
// ============================================================================

/**
 * Placeholder rows for `Sidebar.Loading`, grouped like a real nav. Each string
 * is a label-width utility; each group renders a group label above its items.
 */
const SIDEBAR_LOADING_GROUPS: readonly (readonly string[])[] = [
  ['w-28', 'w-40', 'w-24'],
  ['w-24', 'w-36', 'w-32'],
];

/**
 * Loading state for the whole sidebar nav: nav-item-shaped placeholder rows
 * (icon + label) grouped like the real nav, composed from `SkeletonLine` so it
 * shares the skeleton shimmer. Drop it in place of the nav content while
 * routes/permissions resolve. When collapsed only the icon squares remain.
 *
 * @example
 * ```tsx
 * <Sidebar>
 *   {isLoading ? <Sidebar.Loading /> : <Sidebar.Content>…</Sidebar.Content>}
 * </Sidebar>
 * ```
 */
export const SidebarLoading = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<'div'> & {
    /** Accessible label announced to assistive tech. */
    label?: string;
  }
>(({ className, label = 'Loading', ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="loading"
    role="status"
    aria-label={label}
    className={cn('flex min-h-0 w-full flex-1 flex-col gap-4 px-2 py-3', className)}
    {...props}
  >
    {SIDEBAR_LOADING_GROUPS.map((widths, groupIndex) => (
      <div key={groupIndex} className="flex flex-col gap-0.5">
        <SkeletonLine className="mb-1 ml-2 h-2 w-16 rounded-full group-data-[state=collapsed]/sidebar:hidden" />
        {widths.map((width, itemIndex) => (
          <div
            key={itemIndex}
            className="flex min-h-8.5 items-center gap-3 rounded-lg px-3 group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:px-0"
          >
            <SkeletonLine className="size-4.5 shrink-0 rounded-md" />
            <SkeletonLine
              className={cn(
                'h-2.5 rounded-full group-data-[state=collapsed]/sidebar:hidden',
                width,
              )}
            />
          </div>
        ))}
      </div>
    ))}
  </div>
));

SidebarLoading.displayName = 'Sidebar.Loading';

// ============================================================================
// Sidebar Group
// ============================================================================

/**
 * Groups related menu items with an optional label.
 *
 * @example
 * ```tsx
 * <Sidebar.Group>
 *   <Sidebar.GroupLabel>Build</Sidebar.GroupLabel>
 *   <Sidebar.Menu>...</Sidebar.Menu>
 * </Sidebar.Group>
 * ```
 */
export const SidebarGroup = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      data-sidebar="group"
      className={cn('flex min-w-0 flex-col gap-y-px', className)}
      {...props}
    >
      {children}
    </div>
  ),
);

SidebarGroup.displayName = 'Sidebar.Group';

// ============================================================================
// Sidebar GroupLabel
// ============================================================================

/**
 * Section label for a sidebar group (e.g., "Build", "Protect & Connect").
 * When the sidebar is collapsed, renders as a thin horizontal divider.
 * When it's the first group, the divider is hidden (nothing above to separate from).
 *
 * @example
 * ```tsx
 * <Sidebar.GroupLabel>Build</Sidebar.GroupLabel>
 * ```
 */
export const SidebarGroupLabel = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      data-sidebar="group-label"
      className={cn(
        // Grid-rows for smooth collapse animation
        'grid overflow-hidden',
        'transition-[grid-template-rows,margin,border-color] duration-(--sidebar-animation-duration) ease-(--sidebar-easing)',
        // Mobile: no collapse animation — sidebar is always expanded
        'group-data-[mobile=true]/sidebar:transition-none',
        // Collapsed: spacer with divider line between icon groups
        'my-3 grid-rows-[0fr] border-b border-border',
        // First group: no spacer or divider needed
        '[[data-sidebar=group]:first-child_&]:my-0 [[data-sidebar=group]:first-child_&]:border-transparent',
        // Expanded: reveal the label text
        'group-not-data-[state=collapsed]/sidebar:my-0 group-not-data-[state=collapsed]/sidebar:grid-rows-[1fr] group-not-data-[state=collapsed]/sidebar:border-transparent',
        // Mobile: always show labels (sidebar content is always expanded on mobile)
        'group-data-[mobile=true]/sidebar:my-0 group-data-[mobile=true]/sidebar:grid-rows-[1fr] group-data-[mobile=true]/sidebar:border-transparent',
        className,
      )}
      {...props}
    >
      <div className="min-h-0 min-w-0">
        <div
          className={cn(
            'mt-4 mb-2 truncate px-3 text-sm font-medium text-muted-foreground',
            // First group: less top margin
            '[[data-sidebar=group]:first-child_&]:mt-2',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  ),
);

SidebarGroupLabel.displayName = 'Sidebar.GroupLabel';

// ============================================================================
// MenuItem / MenuSubItem auto-wrap contexts
// ============================================================================

/**
 * When `true`, indicates the component is already wrapped in a `MenuItem` `<li>`.
 * `MenuButton` checks this: if `false`, it auto-wraps itself in an `<li>`.
 */
