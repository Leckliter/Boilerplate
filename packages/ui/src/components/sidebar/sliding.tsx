'use client';

import React, {
  type ComponentPropsWithoutRef,
  createContext,
  forwardRef,
  useCallback,
  useContext,
} from 'react';

import { cn } from '../../lib/utils';

// ============================================================================

const SlidingViewActiveContext = createContext<string>('');

export interface SidebarSlidingViewsProps extends ComponentPropsWithoutRef<'div'> {
  /** Key of the currently active view. Must match a child `SlidingView` value. */
  activeKey: string;
  /**
   * Slide direction for the transition.
   * - `"left"`: new view slides in from the right
   * - `"right"`: new view slides in from the left
   * @default "left"
   */
  direction?: 'left' | 'right';
}

/**
 * Container for animated horizontal transitions between navigation surfaces
 * (e.g., account ↔ zone). Inactive views are marked `aria-hidden` and `inert`.
 *
 * Animation respects `prefers-reduced-motion`.
 *
 * @example
 * ```tsx
 * <Sidebar.SlidingViews activeKey={surface} direction="left">
 *   <Sidebar.SlidingView value="account">
 *     <Sidebar.Content>...account nav...</Sidebar.Content>
 *   </Sidebar.SlidingView>
 *   <Sidebar.SlidingView value="zone">
 *     <Sidebar.Content>...zone nav...</Sidebar.Content>
 *   </Sidebar.SlidingView>
 * </Sidebar.SlidingViews>
 * ```
 */
export const SidebarSlidingViews = forwardRef<HTMLDivElement, SidebarSlidingViewsProps>(
  ({ activeKey, direction: _direction = 'left', className, children, ...props }, ref) => {
    const childArray = React.Children.toArray(children);
    const activeIndex = childArray.findIndex(
      (child) =>
        React.isValidElement(child) && (child.props as { value?: string }).value === activeKey,
    );
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const translateX = activeIndex > 0 ? `-${activeIndex * 100}%` : '0%';

    return (
      <SlidingViewActiveContext.Provider value={activeKey}>
        <div
          ref={ref}
          data-sidebar="sliding-views"
          className={cn('flex min-h-0 max-w-(--sidebar-width) flex-1 overflow-hidden', className)}
          {...props}
        >
          <div
            className="flex min-h-0 w-full shrink-0"
            style={{
              transform: `translateX(${translateX})`,
              transition: prefersReducedMotion
                ? 'none'
                : `transform var(--sidebar-animation-duration) var(--sidebar-easing)`,
            }}
          >
            {children}
          </div>
        </div>
      </SlidingViewActiveContext.Provider>
    );
  },
);

SidebarSlidingViews.displayName = 'Sidebar.SlidingViews';

export interface SidebarSlidingViewProps extends ComponentPropsWithoutRef<'div'> {
  /** Unique key matching this view. Must correspond to `activeKey` on `SlidingViews`. */
  value: string;
}

/**
 * Individual panel inside `SlidingViews`. Inactive views are automatically
 * marked `aria-hidden` and `inert` so they're unreachable by keyboard/screen readers.
 */
export const SidebarSlidingView = forwardRef<HTMLDivElement, SidebarSlidingViewProps>(
  ({ value, className, children, ...props }, ref) => {
    const activeKey = useContext(SlidingViewActiveContext);
    const isActive = activeKey === value;

    // Imperatively set inert — React 18.2 doesn't reliably forward the inert
    // attribute to the DOM when set as a JSX prop on initial mount.
    const inertRef = useCallback(
      (node: HTMLDivElement | null) => {
        if (node) {
          if (!isActive) {
            node.setAttribute('inert', '');
          } else {
            node.removeAttribute('inert');
          }
        }
      },
      [isActive],
    );

    // Merge forwarded ref with inert ref
    const mergedRef = useCallback(
      (node: HTMLDivElement | null) => {
        inertRef(node);
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [ref, inertRef],
    );

    return (
      <div
        ref={mergedRef}
        data-sidebar="sliding-view"
        data-value={value}
        aria-hidden={!isActive}
        className={cn(
          'flex min-h-0 w-full shrink-0 flex-col',
          !isActive && 'pointer-events-none',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

SidebarSlidingView.displayName = 'Sidebar.SlidingView';
