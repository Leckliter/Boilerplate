'use client';

import React, {
  type CSSProperties,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import { cn } from '../../lib/utils';
import {
  SIDEBAR_ANIMATION_DURATION_MS,
  SIDEBAR_EASING,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_ICON,
  SidebarSide,
  SidebarVariant,
  useIsMobile,
  useOpenChangeComplete,
} from './shared';

export type SidebarState = 'expanded' | 'collapsed' | 'peeking';

export interface SidebarContextValue {
  state: SidebarState;
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
  variant: 'sidebar' | 'floating' | 'inset';
  side: 'left' | 'right';
  collapsible: 'icon' | 'offcanvas' | 'none';
  width: number;
  resizable: boolean;
  minWidth: number;
  maxWidth: number;
  isResizing: boolean;
  setIsResizing: (resizing: boolean) => void;
  setWidth: (width: number) => void;
  isPeeking: boolean;
  peekable: boolean;
  startPeek: () => void;
  stopPeek: () => void;
  contained: boolean;
  animationDuration: number;
  /**
   * Register a nav item so `scrollToItem(id)` can find it. Internal wiring —
   * `Sidebar.MenuItem` and `Sidebar.MenuButton` call this via their `itemId`
   * prop. Consumers do not call this directly.
   */
  registerItem: (id: string, node: HTMLElement | null) => void;
  /**
   * Scroll a tagged nav item into view. Tag items with `itemId` on
   * `Sidebar.MenuItem` or `Sidebar.MenuButton`. Honors `prefers-reduced-motion`.
   * No-op when the item isn't mounted.
   *
   * @param id — the `itemId` of the target item
   * @param options.align — where the item lands in the viewport (default `"auto"`)
   * @param options.behavior — `"auto"` for instant, `"smooth"` for animated (default `"auto"`)
   */
  scrollToItem: (id: string, options?: SidebarScrollToItemOptions) => void;
  /**
   * Scroll a tagged nav item only when it is outside its sidebar viewport.
   * Explicit alignment controls where an offscreen item lands.
   */
  scrollItemIntoView: (id: string, options?: SidebarScrollToItemOptions) => void;
}

/**
 * Vertical alignment of the target item within the sidebar viewport.
 *
 * - `"start"` — align the item with the top of the viewport
 * - `"center"` — center the item vertically in the viewport
 * - `"end"` — align the item with the bottom of the viewport
 * - `"auto"` — no-op if the item is already visible; otherwise scroll the
 *   minimum distance (like native `scrollIntoView`'s `nearest`)
 */
export type SidebarScrollAlign = 'start' | 'center' | 'end' | 'auto';

export interface SidebarScrollToItemOptions {
  /** Where the item lands in the viewport. Defaults to `"auto"`. */
  align?: SidebarScrollAlign;
  /**
   * Scroll behavior. `"auto"` jumps instantly (default) — best for
   * cross-app landings so users don't watch the sidebar animate on entry.
   * `"smooth"` animates the scroll. `prefers-reduced-motion` forces `"auto"`.
   */
  behavior?: 'auto' | 'smooth';
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

/**
 * Hook to access sidebar state and actions from any descendant component.
 *
 * @example
 * ```tsx
 * const { state, open, toggleSidebar, isMobile } = useSidebar();
 * ```
 *
 * @throws Error if used outside a `Sidebar.Provider`.
 */
export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a Sidebar.Provider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

export interface SidebarProviderProps {
  /** Initial open state when uncontrolled. @default true */
  defaultOpen?: boolean;
  /** Controlled open state. */
  open?: boolean;
  /** Callback when open state changes (controlled mode). */
  onOpenChange?: (open: boolean) => void;
  /** Callback after the sidebar finishes its open or close transition. */
  onOpenChangeComplete?: (open: boolean) => void;
  /** Sidebar layout variant. @default "sidebar" */
  variant?: SidebarVariant;
  /** Which side the sidebar is on. @default "left" */
  side?: SidebarSide;
  collapsible?: 'icon' | 'offcanvas' | 'none';
  /** Enable drag-to-resize on the sidebar edge. @default false */
  resizable?: boolean;
  /** Initial width in pixels when resizable. @default 256 */
  defaultWidth?: number;
  /** Minimum width in pixels when resizing. @default 200 */
  minWidth?: number;
  /** Maximum width in pixels when resizing. @default 480 */
  maxWidth?: number;
  /** Callback when width changes during resize. */
  onWidthChange?: (width: number) => void;
  /**
   * When true, the collapsed sidebar uses absolute positioning instead of fixed,
   * keeping it scoped inside a bounded parent. Useful for demos and embedded sidebars.
   * @default false
   */
  contained?: boolean;
  /**
   * When true, hovering or focusing the collapsed sidebar temporarily expands it.
   * The `state` will be `"peeking"` during the peek. Moving away collapses it back.
   * @default false
   */
  peekable?: boolean;
  /**
   * Duration of sidebar expand/collapse animation in milliseconds.
   * @default 250
   */
  animationDuration?: number;
  /**
   * Viewport width (in px) below which the sidebar renders as a mobile dialog
   * sheet instead of the desktop aside rail.
   * @default 768
   */
  mobileBreakpoint?: number;
  /** Content — typically `<Sidebar>` + main content. */
  children: ReactNode;
  /** Additional CSS classes for the wrapper div. */
  className?: string;
  /** Inline styles for the wrapper div. */
  style?: CSSProperties;
}

/**
 * Sidebar context provider. Manages expand/collapse state and mobile detection.
 * Renders a flex wrapper div with CSS custom properties for sidebar width.
 *
 * @example
 * ```tsx
 * <Sidebar.Provider defaultOpen>
 *   <Sidebar>{...}</Sidebar>
 *   <main className="flex-1">{...}</main>
 * </Sidebar.Provider>
 * ```
 */
const DEFAULT_WIDTH_PX = 256;
const MIN_WIDTH_PX = 200;
const MAX_WIDTH_PX = 480;

export function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  onOpenChangeComplete,
  variant = 'sidebar',
  side = 'left',
  collapsible = 'icon',
  resizable = false,
  defaultWidth = DEFAULT_WIDTH_PX,
  minWidth = MIN_WIDTH_PX,
  maxWidth = MAX_WIDTH_PX,
  onWidthChange,
  contained = false,
  peekable = false,
  animationDuration = SIDEBAR_ANIMATION_DURATION_MS,
  mobileBreakpoint,
  children,
  className,
  style,
}: SidebarProviderProps) {
  const isMobile = useIsMobile(mobileBreakpoint);
  const [_openMobile, _setOpenMobile] = useState(false);
  const [width, setWidthState] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [isPeeking, setIsPeeking] = useState(false);

  // When controlled (`openProp` provided), use it directly for mobile too.
  // When uncontrolled, use internal `_openMobile` state.
  const openMobile = isMobile && openProp !== undefined ? openProp : _openMobile;

  const setOpenMobile = useCallback(
    (next: boolean) => {
      _setOpenMobile(next);
      // In controlled mode on mobile, notify the consumer
      if (isMobile && openProp !== undefined) {
        setOpenProp?.(next);
      }
    },
    [isMobile, openProp, setOpenProp],
  );

  const setWidth = useCallback(
    (newWidth: number) => {
      const clamped = Math.min(maxWidth, Math.max(minWidth, newWidth));
      setWidthState(clamped);
      onWidthChange?.(clamped);
    },
    [minWidth, maxWidth, onWidthChange],
  );

  const [_open, _setOpen] = useState(defaultOpen);
  const open = openProp ?? _open;
  const setOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof value === 'function' ? value(open) : value;
      setOpenProp?.(next);
      _setOpen(next);
    },
    [setOpenProp, open],
  );

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setOpenMobile(!openMobile);
    } else {
      setIsPeeking(false);
      setOpen((prev: boolean) => !prev);
    }
  }, [isMobile, openMobile, setOpenMobile, setOpen]);

  const startPeek = useCallback(() => {
    if (peekable && !open && !isMobile) {
      setIsPeeking(true);
    }
  }, [peekable, open, isMobile]);

  const stopPeek = useCallback(() => {
    setIsPeeking(false);
  }, []);

  const state: SidebarState = isPeeking ? 'peeking' : open ? 'expanded' : 'collapsed';

  const sidebarWidthValue = resizable ? `${width}px` : SIDEBAR_WIDTH;

  // Registry of tagged nav items keyed by `itemId`. Sidebar.SlidingViews can
  // mount multiple viewports at once, so we resolve the OWNING viewport by
  // walking up from the registered element rather than querying a single one.
  const itemsRef = useRef(new Map<string, HTMLElement>());

  const registerItem = useCallback((id: string, node: HTMLElement | null) => {
    const items = itemsRef.current;
    if (node) {
      items.set(id, node);
    } else {
      items.delete(id);
    }
  }, []);

  const scrollToItem = useCallback((id: string, options: SidebarScrollToItemOptions = {}) => {
    const { align = 'auto', behavior = 'auto' } = options;
    const target = itemsRef.current.get(id);
    if (!target) return;
    const viewport = target.closest<HTMLElement>('[data-sidebar="viewport"]');
    if (!viewport) return;

    // Manual scrollTop assignment on the viewport avoids `scrollIntoView`,
    // which walks the ancestor chain and scrolls the document too.
    const targetRect = target.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const viewportScaleY =
      viewport.offsetHeight > 0 && viewportRect.height > 0
        ? viewportRect.height / viewport.offsetHeight
        : 1;
    const itemScrollOffset =
      (targetRect.top - viewportRect.top) / viewportScaleY + viewport.scrollTop;

    let desired: number;
    if (align === 'center') {
      desired = itemScrollOffset - (viewport.clientHeight - target.offsetHeight) / 2;
    } else if (align === 'end') {
      desired = itemScrollOffset - (viewport.clientHeight - target.offsetHeight);
    } else if (align === 'auto') {
      const itemBottom = itemScrollOffset + target.offsetHeight;
      const viewBottom = viewport.scrollTop + viewport.clientHeight;
      if (itemScrollOffset < viewport.scrollTop) {
        desired = itemScrollOffset;
      } else if (itemBottom > viewBottom) {
        desired = itemBottom - viewport.clientHeight;
      } else {
        return;
      }
    } else {
      desired = itemScrollOffset;
    }

    const clamped = Math.max(0, Math.min(desired, viewport.scrollHeight - viewport.clientHeight));
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    viewport.scrollTo({
      top: clamped,
      behavior: reducedMotion ? 'auto' : behavior,
    });
  }, []);

  const scrollItemIntoView = useCallback(
    (id: string, options: SidebarScrollToItemOptions = {}) => {
      const target = itemsRef.current.get(id);
      if (!target) return;
      const viewport = target.closest<HTMLElement>('[data-sidebar="viewport"]');
      if (!viewport) return;

      const targetRect = target.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      if (targetRect.top >= viewportRect.top && targetRect.bottom <= viewportRect.bottom) {
        return;
      }

      scrollToItem(id, options);
    },
    [scrollToItem],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps -- all values are
  // either stable (props, setters) or derived from state that triggers re-render
  const contextValue = useMemo<SidebarContextValue>(
    () => ({
      state,
      open,
      setOpen,
      openMobile,
      setOpenMobile,
      isMobile,
      toggleSidebar,
      variant,
      side,
      collapsible,
      width,
      resizable,
      minWidth,
      maxWidth,
      isResizing,
      setIsResizing,
      setWidth,
      isPeeking,
      peekable,
      startPeek,
      stopPeek,
      contained,
      animationDuration,
      registerItem,
      scrollToItem,
      scrollItemIntoView,
    }),
    [state, open, openMobile, isMobile, width, isResizing, isPeeking],
  );

  const completeDesktopOpenChange = useOpenChangeComplete(
    open,
    animationDuration,
    onOpenChangeComplete,
    !isMobile,
  );
  const completeMobileOpenChange = useOpenChangeComplete(
    openMobile,
    animationDuration,
    onOpenChangeComplete,
    isMobile,
  );
  const completeOpenChange = isMobile ? completeMobileOpenChange : completeDesktopOpenChange;
  const transitionProperty = isMobile ? 'transform' : 'width';
  const handleOpenTransitionEnd = useCallback(
    (event: React.TransitionEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (
        target.closest('[data-sidebar-wrapper]') === event.currentTarget &&
        target.dataset.sidebar === 'sidebar' &&
        event.propertyName === transitionProperty
      ) {
        completeOpenChange();
      }
    },
    [completeOpenChange, transitionProperty],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-sidebar-wrapper=""
        data-state={state}
        data-side={side}
        onTransitionEnd={handleOpenTransitionEnd}
        style={
          {
            '--sidebar-width': sidebarWidthValue,
            '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
            '--sidebar-animation-duration': `${animationDuration}ms`,
            '--sidebar-easing': SIDEBAR_EASING,
            ...style,
          } as CSSProperties
        }
        className={cn(
          'group/sidebar-wrapper relative isolate flex w-full [--sidebar-active-bg:var(--color-tint)] [--sidebar-bg:var(--color-card)]',
          !contained && !isMobile && 'min-h-svh',
          'has-data-[variant=inset]:bg-recessed',
          isResizing && 'select-none',
          className,
        )}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

SidebarProvider.displayName = 'Sidebar.Provider';

// ============================================================================
// Sidebar Root
// ============================================================================
