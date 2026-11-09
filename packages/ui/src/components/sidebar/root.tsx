'use client';

import React, {
  type ComponentPropsWithoutRef,
  type ReactNode,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
} from 'react';

import { cn } from '../../lib/utils';
import { TooltipProvider } from '../tooltip';
import { useSidebar } from './provider';
import { FOCUSABLE_SELECTOR } from './shared';

export interface SidebarRootProps extends ComponentPropsWithoutRef<'aside'> {
  /** Additional CSS classes for the sidebar element. */
  className?: string;
  /** Additional CSS classes for the inner content container. */
  contentClassName?: string;
  /** Sidebar content — Header, Content, Footer, etc. */
  children: ReactNode;
  /**
   * On mobile, expand the sidebar sheet to the full viewport width instead of
   * `--sidebar-width`. The backdrop is suppressed since nothing shows behind it.
   * Pair with breadcrumbs in the page header so the current route stays visible.
   * @default false
   */
  fullScreenOnMobile?: boolean;
}

/**
 * Main sidebar container. Renders as `<aside>` on desktop, modal sidebar sheet on mobile.
 * Must be used inside `Sidebar.Provider`.
 *
 * @example
 * ```tsx
 * <Sidebar.Provider>
 *   <Sidebar>
 *     <Sidebar.Header>...</Sidebar.Header>
 *     <Sidebar.Content>...</Sidebar.Content>
 *     <Sidebar.Footer>...</Sidebar.Footer>
 *   </Sidebar>
 * </Sidebar.Provider>
 * ```
 */
export const SidebarRoot = forwardRef<HTMLElement, SidebarRootProps>(
  ({ className, contentClassName, children, fullScreenOnMobile = false, ...props }, ref) => {
    const {
      state,
      open,
      isMobile,
      openMobile,
      setOpenMobile,
      side,
      variant,
      collapsible,
      isResizing,
      resizable,
      width,
      isPeeking,
      startPeek,
      stopPeek,
      contained,
    } = useSidebar();

    // --- Mobile a11y hooks (must be before early returns) ---

    // Imperatively set inert on the mobile sidebar — React 18 doesn't
    // reliably forward the inert attribute as a JSX prop on initial mount.
    const mobileAsideRef = useCallback(
      (node: HTMLElement | null) => {
        if (node) {
          if (!openMobile) {
            node.setAttribute('inert', '');
          } else {
            node.removeAttribute('inert');
          }
        }
      },
      [openMobile],
    );

    // Merge forwarded ref with inert ref for the mobile aside
    const mergedMobileRef = useCallback(
      (node: HTMLElement | null) => {
        mobileAsideRef(node);
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLElement | null>).current = node;
        }
      },
      [ref, mobileAsideRef],
    );

    // Refs for mobile focus management (declared before effects that use them)
    const triggerRef = useRef<Element | null>(null);
    const mobileNodeRef = useRef<HTMLElement | null>(null);
    const shouldRestoreFocusRef = useRef(false);
    const isPointerInPeekZoneRef = useRef(false);

    // Escape key closes the mobile sidebar
    useEffect(() => {
      if (!isMobile || !openMobile) return;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          shouldRestoreFocusRef.current = true;
          setOpenMobile(false);
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, [isMobile, openMobile, setOpenMobile]);

    // When the mobile sidebar opens, move focus into it;
    // when it closes, return focus to the element that opened it.
    useEffect(() => {
      if (!isMobile) return;
      if (openMobile) {
        triggerRef.current = document.activeElement;
        shouldRestoreFocusRef.current = false;
        // Wait a frame so the aside is no longer inert before focusing
        requestAnimationFrame(() => {
          const firstFocusable =
            mobileNodeRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
          (firstFocusable ?? mobileNodeRef.current)?.focus();
        });
      } else if (shouldRestoreFocusRef.current && triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
        shouldRestoreFocusRef.current = false;
        triggerRef.current = null;
      }
    }, [isMobile, openMobile]);

    const handlePeekBlur = useCallback(
      (e: React.FocusEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node) && !isPointerInPeekZoneRef.current) {
          stopPeek();
        }
      },
      [stopPeek],
    );

    const handlePeekMouseEnter = useCallback(() => {
      isPointerInPeekZoneRef.current = true;
      startPeek();
    }, [startPeek]);

    const handlePeekMouseLeave = useCallback(() => {
      isPointerInPeekZoneRef.current = false;
      stopPeek();
    }, [stopPeek]);

    if (collapsible === 'none') {
      return (
        <aside
          ref={ref}
          data-state="expanded"
          data-side={side}
          data-variant={variant}
          data-sidebar="sidebar"
          style={{
            width: 'var(--sidebar-width)',
            minWidth: 'var(--sidebar-width)',
            maxWidth: 'var(--sidebar-width)',
          }}
          className={cn(
            'relative flex h-full shrink-0 grow-0 flex-col overflow-hidden bg-(--sidebar-bg) text-foreground',
            variant === 'sidebar' &&
              (side === 'left' ? 'border-r border-border' : 'border-l border-border'),
            variant === 'floating' && 'm-2 rounded-lg border border-border shadow-lg',
            className,
          )}
          {...props}
        >
          {children}
        </aside>
      );
    }

    if (isMobile) {
      return (
        <>
          {/* Backdrop — click to close */}
          <div
            data-sidebar-backdrop=""
            className={cn(
              contained ? 'absolute inset-0 z-40 bg-recessed' : 'fixed inset-0 z-40 bg-recessed',
              'transition-opacity duration-(--sidebar-animation-duration) ease-(--sidebar-easing)',
              'motion-reduce:transition-none',
              openMobile && !fullScreenOnMobile ? 'opacity-80' : 'pointer-events-none opacity-0',
            )}
            onClick={() => {
              shouldRestoreFocusRef.current = true;
              setOpenMobile(false);
            }}
            aria-hidden="true"
          />

          {/* Mobile sidebar — navigation landmark with focus management */}
          <nav
            ref={(node) => {
              mergedMobileRef(node);
              mobileNodeRef.current = node;
            }}
            tabIndex={-1}
            aria-label="Navigation"
            aria-hidden={!openMobile}
            data-state={openMobile ? 'expanded' : 'collapsed'}
            data-side={side}
            data-variant={variant}
            data-collapsible={collapsible}
            data-sidebar="sidebar"
            data-mobile="true"
            className={cn(
              'group/sidebar inset-y-0 z-50 flex flex-col overflow-hidden',
              contained ? 'absolute' : 'fixed',
              fullScreenOnMobile ? 'w-full' : 'w-(--sidebar-width)',
              'bg-(--sidebar-bg) text-foreground',
              // No border when full-screen — there is no adjacent content to divide.
              !fullScreenOnMobile && 'border-r border-border',
              'transition-transform duration-(--sidebar-animation-duration) ease-(--sidebar-easing)',
              'motion-reduce:transition-none',
              side === 'left' && 'left-0',
              side === 'right' && 'right-0',
              side === 'left' && (openMobile ? 'translate-x-0' : '-translate-x-full'),
              side === 'right' && (openMobile ? 'translate-x-0' : 'translate-x-full'),
              className,
            )}
            {...props}
          >
            {children}
          </nav>
        </>
      );
    }

    // --- Desktop two-layer architecture ---
    // Rail: the <aside> whose width drives layout (stays collapsed during peek).
    // Content container: holds actual sidebar content, can overlay when peeking.

    // Rail width: based on open state only (not peeking)
    const collapsedWidth = collapsible === 'icon' ? 'var(--sidebar-width-icon)' : '0px';
    const expandedWidth = resizable ? `${width}px` : 'var(--sidebar-width)';
    const railWidth = open ? expandedWidth : collapsedWidth;

    // Content container width: expanded during peek
    const contentExpanded = open || isPeeking;
    const contentWidth = contentExpanded ? expandedWidth : collapsedWidth;

    const borderClasses =
      variant === 'sidebar'
        ? side === 'left'
          ? 'border-r border-border'
          : 'border-l border-border'
        : variant === 'floating'
          ? 'border border-border'
          : '';

    return (
      <aside
        ref={ref}
        data-state={state}
        data-side={side}
        data-variant={variant}
        data-collapsible={collapsible}
        data-sidebar="sidebar"
        style={{ width: railWidth }}
        className={cn(
          'group/sidebar relative h-full shrink-0 grow-0',
          'overflow-visible', // allow content container to overlay when peeking
          'transition-[width] duration-(--sidebar-animation-duration) ease-(--sidebar-easing)',
          'motion-reduce:transition-none',
          isResizing && 'transition-none!',
          variant === 'floating' && 'm-2 rounded-lg shadow-lg',
          className,
        )}
        {...props}
      >
        <TooltipProvider>
          {(() => {
            // Separate footer children from the rest so hovering the footer
            // doesn't trigger peeking. Footer is rendered outside the peek zone.
            const childArray = React.Children.toArray(children);
            const footerChildren = childArray.filter(
              (child) =>
                React.isValidElement(child) &&
                (child.type as { displayName?: string })?.displayName === 'Sidebar.Footer',
            );
            const nonFooterChildren = childArray.filter(
              (child) =>
                !React.isValidElement(child) ||
                (child.type as { displayName?: string })?.displayName !== 'Sidebar.Footer',
            );

            return (
              <div
                data-sidebar="content-container"
                style={{ width: contentWidth }}
                className={cn(
                  'flex h-full flex-col',
                  'min-w-0 overflow-hidden whitespace-nowrap',
                  'bg-(--sidebar-bg) text-foreground',
                  borderClasses,
                  'transition-[width] duration-(--sidebar-animation-duration) ease-(--sidebar-easing)',
                  'motion-reduce:transition-none',
                  isResizing && 'transition-none!',
                  !open &&
                    cn(
                      contained ? 'absolute' : 'fixed',
                      'inset-y-0 z-40',
                      side === 'left' && 'left-0',
                      side === 'right' && 'right-0',
                    ),
                  open && 'relative',
                  contentClassName,
                )}
              >
                {/* Peek zone — header + content (not footer) */}
                <div
                  data-sidebar="peek-zone"
                  className="flex min-h-0 flex-1 flex-col"
                  onMouseEnter={handlePeekMouseEnter}
                  onMouseLeave={handlePeekMouseLeave}
                  onFocus={startPeek}
                  onBlur={handlePeekBlur}
                >
                  {nonFooterChildren}
                </div>
                {/* Footer — outside peek zone */}
                {footerChildren}
              </div>
            );
          })()}
        </TooltipProvider>
      </aside>
    );
  },
);

SidebarRoot.displayName = 'Sidebar';
