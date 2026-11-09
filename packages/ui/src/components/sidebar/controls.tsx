'use client';

import React, { type ComponentPropsWithoutRef, forwardRef, useRef } from 'react';

import { XIcon } from '../icons';
import { cn } from '../../lib/utils';
import { Button } from '../button';
import { useSidebar } from './provider';

/**
 * Horizontal divider line between sidebar sections.
 */
export const SidebarSeparator = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-sidebar="separator" className={cn('my-3 px-2', className)} {...props}>
      <div className="border-b border-border" />
    </div>
  ),
);

SidebarSeparator.displayName = 'Sidebar.Separator';

// ============================================================================
// Sidebar Trigger
// ============================================================================

// ============================================================================
// Sidebar PanelIcon
// ============================================================================

/**
 * Animated sidebar panel icon. The vertical divider line slides based
 * on the sidebar's open/closed state.
 */
function SidebarPanelIcon({ className }: { className?: string }) {
  const { open } = useSidebar();

  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className={cn('shrink-0', className)}
    >
      <path d="M21.25 6.72v10.56a2.97 2.97 0 0 1-2.97 2.97H5.72a2.97 2.97 0 0 1-2.97-2.97V6.72a2.97 2.97 0 0 1 2.97-2.97h12.56a2.97 2.97 0 0 1 2.97 2.97" />
      <path
        d="M6.25 7.25v9.5"
        className={cn(
          'transition-transform duration-(--sidebar-animation-duration) ease-(--sidebar-easing)',
          open ? 'translate-x-px' : 'translate-x-[10.5px]',
        )}
      />
    </svg>
  );
}

SidebarPanelIcon.displayName = 'Sidebar.PanelIcon';

/**
 * Button that toggles the sidebar open/collapsed. Uses `toggleSidebar()` from context.
 * Defaults to an animated `SidebarPanelIcon`.
 *
 * @example
 * ```tsx
 * <Sidebar.Trigger />
 * ```
 */
export const SidebarTrigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'>>(
  ({ className, children, onClick, ...props }, ref) => {
    const { open, toggleSidebar } = useSidebar();

    return (
      <button
        ref={ref}
        type="button"
        data-sidebar="trigger"
        data-slot="sidebar-trigger"
        aria-expanded={open}
        aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
        className={cn(
          'flex size-8.5 shrink-0 cursor-pointer items-center justify-center rounded-lg',
          'text-muted-foreground hover:bg-(--sidebar-active-bg) hover:text-foreground',
          'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
          className,
        )}
        onClick={(e) => {
          onClick?.(e);
          toggleSidebar();
        }}
        {...props}
      >
        {children ?? <SidebarPanelIcon />}
      </button>
    );
  },
);

SidebarTrigger.displayName = 'Sidebar.Trigger';

// ============================================================================
// Sidebar Close
// ============================================================================

/**
 * Close button for the mobile sidebar sheet. Most useful inside
 * `Sidebar.Header` when `fullScreenOnMobile` is true, where the backdrop is
 * hidden and there is no adjacent page content to click.
 *
 * On desktop this is a no-op (the sidebar is not a sheet), so it can be
 * rendered unconditionally without conditional checks.
 *
 * @example
 * ```tsx
 * <Sidebar.Header>
 *   <span className="flex-1">Navigation</span>
 *   <Sidebar.Close />
 * </Sidebar.Header>
 * ```
 */
export const SidebarClose = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'>>(
  ({ className, onClick, ...props }, ref) => {
    const { setOpenMobile } = useSidebar();

    return (
      <Button
        ref={ref}
        variant="ghost"
        shape="square"
        size="sm"
        data-sidebar="close"
        data-slot="sidebar-close"
        aria-label="Close navigation"
        className={cn('shrink-0', className)}
        onClick={(e) => {
          onClick?.(e);
          setOpenMobile(false);
        }}
        {...props}
      >
        <XIcon size={18} />
      </Button>
    );
  },
);

SidebarClose.displayName = 'Sidebar.Close';

// ============================================================================
// Sidebar Rail
// ============================================================================

/**
 * Invisible interaction strip at the sidebar edge for click-to-toggle.
 * Renders a thin hover-sensitive area between the sidebar and main content.
 */
export const SidebarRail = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'>>(
  ({ className, ...props }, ref) => {
    const { toggleSidebar } = useSidebar();

    return (
      <button
        ref={ref}
        type="button"
        data-sidebar="rail"
        data-slot="sidebar-rail"
        aria-label="Toggle sidebar"
        tabIndex={-1}
        className={cn(
          'absolute inset-y-0 z-1 hidden w-4 -translate-x-1/2 cursor-pointer transition-all',
          'after:absolute after:inset-y-0 after:left-1/2 after:w-0.5',
          'hover:after:bg-primary/20',
          'group-data-[side=left]/sidebar-wrapper:right-0',
          'group-data-[side=right]/sidebar-wrapper:left-0',
          'sm:flex',
          className,
        )}
        onClick={toggleSidebar}
        {...props}
      />
    );
  },
);

SidebarRail.displayName = 'Sidebar.Rail';

// ============================================================================
// Sidebar ResizeHandle
// ============================================================================

/**
 * Drag handle for resizing the sidebar. Renders when `resizable` is true in
 * both expanded and collapsed states.
 *
 * - **Expanded → drag inward past `minWidth`**: auto-collapses to icon-only.
 * - **Collapsed → drag outward past `minWidth`**: auto-expands and begins
 *   tracking width from `minWidth`.
 */
export const SidebarResizeHandle = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<'button'>
>(({ className, ...props }, ref) => {
  const {
    side,
    resizable,
    setIsResizing,
    setWidth,
    setOpen,
    open,
    minWidth,
    width: currentWidth,
    maxWidth,
  } = useSidebar();
  const startX = useRef(0);
  const startWidth = useRef(0);
  const wasCollapsed = useRef(false);

  if (!resizable) return null;

  const KEYBOARD_STEP = 10;

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsResizing(true);
    startX.current = e.clientX;
    wasCollapsed.current = !open;

    const wrapper = (e.currentTarget as HTMLElement).closest('[data-sidebar-wrapper]');
    const sidebar = wrapper?.querySelector("[data-sidebar='sidebar']");
    startWidth.current = sidebar?.getBoundingClientRect().width ?? 0;

    const cleanup = () => {
      setIsResizing(false);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta =
        side === 'left' ? moveEvent.clientX - startX.current : startX.current - moveEvent.clientX;
      const rawWidth = startWidth.current + delta;

      if (wasCollapsed.current) {
        // Dragging outward from collapsed — expand once past minWidth
        if (rawWidth >= minWidth) {
          wasCollapsed.current = false;
          setOpen(true);
          setWidth(rawWidth);
        }
        return;
      }

      // Dragging inward while expanded — collapse when below minWidth
      if (rawWidth < minWidth) {
        setOpen(false);
        wasCollapsed.current = true;
        return;
      }

      setWidth(rawWidth);
    };

    const handlePointerUp = () => {
      cleanup();
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const grow = side === 'left' ? 'ArrowRight' : 'ArrowLeft';
    const shrink = side === 'left' ? 'ArrowLeft' : 'ArrowRight';

    if (e.key === grow) {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setWidth(minWidth);
      } else {
        setWidth(Math.min(currentWidth + KEYBOARD_STEP, maxWidth));
      }
    } else if (e.key === shrink) {
      e.preventDefault();
      const next = currentWidth - KEYBOARD_STEP;
      if (next < minWidth) {
        setOpen(false);
      } else {
        setWidth(next);
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'End') {
      e.preventDefault();
      setOpen(true);
      setWidth(maxWidth);
    }
  };

  return (
    <button
      ref={ref}
      type="button"
      aria-label="Resize sidebar"
      tabIndex={0}
      data-sidebar="resize-handle"
      className={cn(
        // Hit area inside the sidebar edge; thin visual line pinned to the edge via ::after
        'absolute inset-y-0 z-2 hidden w-3 cursor-col-resize sm:block',
        'after:absolute after:inset-y-0 after:w-0.5',
        'after:bg-transparent after:transition-colors',
        'hover:after:bg-hairline focus-visible:after:bg-hairline active:after:bg-hairline',
        'focus:outline-hidden',
        side === 'left' && 'right-0 after:right-0',
        side === 'right' && 'left-0 after:left-0',
        className,
      )}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
});

SidebarResizeHandle.displayName = 'Sidebar.ResizeHandle';

// ============================================================================
// Collapsible context + components (custom implementation, no Base UI dep)
// ============================================================================
