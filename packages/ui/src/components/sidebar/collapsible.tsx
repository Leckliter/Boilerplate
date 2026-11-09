'use client';

import React, {
  type ComponentPropsWithoutRef,
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useId,
  useRef,
  useState,
} from 'react';

import { CaretRightIcon } from '../icons';
import { cn } from '../../lib/utils';
import { SidebarContextValue, useSidebar } from './provider';
import { useOpenChangeComplete } from './shared';

export type SidebarCollapsible = 'icon' | 'offcanvas' | 'none';

interface SidebarCollapseContextValue {
  contentId: string;
  isOpen: boolean;
  isCollapsible: boolean;
  autoScrollOnOpen: boolean;
  toggle: () => void;
  completeOpenChange: () => void;
}

const isCollapsibleContentShown = (
  isOpen: boolean,
  { isMobile, openMobile, state }: SidebarContextValue,
) => isOpen && (isMobile ? openMobile : state !== 'collapsed');

const SidebarCollapseContext = createContext<SidebarCollapseContextValue>({
  contentId: '',
  isOpen: true,
  isCollapsible: false,
  autoScrollOnOpen: false,
  toggle: () => {},
  completeOpenChange: () => {},
});

export interface SidebarCollapsibleProps extends ComponentPropsWithoutRef<'div'> {
  /** Initial open state (uncontrolled). @default false */
  defaultOpen?: boolean;
  /** Controlled open state. */
  open?: boolean;
  /** Callback when open state changes. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Callback after the content finishes showing or hiding. Also fires when the
   * sidebar expands or collapses an open section, including the mobile drawer.
   */
  onOpenChangeComplete?: (open: boolean) => void;
  /** Scroll the expanded content into view after opening. @default false */
  autoScrollOnOpen?: boolean;
}

/**
 * Collapsible wrapper for sidebar sub-menu expand/collapse.
 * Manages open/close state and provides context to Trigger and Content children.
 *
 * Keyboard behaviour: when a child receives keyboard focus (`focus-visible`)
 * while collapsed, the section auto-expands. It collapses again on blur
 * unless it was explicitly opened via click or a child has `data-active`.
 *
 * @example
 * ```tsx
 * <Sidebar.MenuItem>
 *   <Sidebar.Collapsible defaultOpen>
 *     <Sidebar.CollapsibleTrigger
 *       render={<Sidebar.MenuButton icon={CodeIcon}>Compute<Sidebar.MenuChevron /></Sidebar.MenuButton>}
 *     />
 *     <Sidebar.CollapsibleContent>
 *       <Sidebar.MenuSub>...</Sidebar.MenuSub>
 *     </Sidebar.CollapsibleContent>
 *   </Sidebar.Collapsible>
 * </Sidebar.MenuItem>
 * ```
 */
export const SidebarCollapsible = forwardRef<HTMLDivElement, SidebarCollapsibleProps>(
  (
    {
      defaultOpen = false,
      open: openProp,
      onOpenChange,
      onOpenChangeComplete,
      autoScrollOnOpen = false,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const sidebar = useSidebar();
    const { animationDuration } = sidebar;
    const [internalOpen, setInternalOpen] = useState(defaultOpen);
    const isOpen = openProp ?? internalOpen;
    const isContentShown = isCollapsibleContentShown(isOpen, sidebar);
    const contentId = useId();
    const keyboardExpandedRef = useRef(false);

    const toggle = useCallback(() => {
      const next = !isOpen;
      setInternalOpen(next);
      onOpenChange?.(next);
      // If user explicitly clicks, clear the keyboard-expanded flag
      keyboardExpandedRef.current = false;
    }, [isOpen, onOpenChange]);

    const completeOpenChange = useOpenChangeComplete(
      isContentShown,
      animationDuration,
      onOpenChangeComplete,
    );

    const contextValue = useMemo<SidebarCollapseContextValue>(
      () => ({
        contentId,
        isOpen,
        isCollapsible: true,
        autoScrollOnOpen,
        toggle,
        completeOpenChange,
      }),
      [contentId, isOpen, autoScrollOnOpen, toggle, completeOpenChange],
    );

    const handleFocusIn = useCallback(
      (e: React.FocusEvent<HTMLDivElement>) => {
        // Auto-expand on keyboard focus (focus-visible) when collapsed
        if (!isOpen && (e.target as HTMLElement).matches(':focus-visible')) {
          keyboardExpandedRef.current = true;
          setInternalOpen(true);
          onOpenChange?.(true);
        }
      },
      [isOpen, onOpenChange],
    );

    const handleFocusOut = useCallback(
      (e: React.FocusEvent<HTMLDivElement>) => {
        // Auto-collapse on blur if it was keyboard-expanded (not click-expanded)
        // and no child has data-active
        if (
          keyboardExpandedRef.current &&
          !e.currentTarget.contains(e.relatedTarget as Node) &&
          !e.currentTarget.querySelector('[data-active]')
        ) {
          keyboardExpandedRef.current = false;
          setInternalOpen(false);
          onOpenChange?.(false);
        }
      },
      [onOpenChange],
    );

    return (
      <SidebarCollapseContext.Provider value={contextValue}>
        <div
          ref={ref}
          data-open={isOpen || undefined}
          className={cn('min-w-0', className)}
          onFocus={handleFocusIn}
          onBlur={handleFocusOut}
          {...props}
        >
          {children}
        </div>
      </SidebarCollapseContext.Provider>
    );
  },
);

SidebarCollapsible.displayName = 'Sidebar.Collapsible';

export interface SidebarCollapsibleTriggerProps {
  /** Element to render as the trigger. Gets aria-expanded, aria-controls, and onClick merged. */
  render: React.ReactElement;
}

/**
 * Trigger for a sidebar collapsible section. Uses `render` prop to compose
 * with `Sidebar.MenuButton` or `Sidebar.MenuSubButton`.
 *
 * @example
 * ```tsx
 * <Sidebar.CollapsibleTrigger
 *   render={
 *     <Sidebar.MenuButton icon={CodeIcon}>
 *       Compute
 *       <Sidebar.MenuChevron />
 *     </Sidebar.MenuButton>
 *   }
 * />
 * ```
 */
export function SidebarCollapsibleTrigger({ render }: SidebarCollapsibleTriggerProps) {
  const { contentId, isOpen, toggle } = useContext(SidebarCollapseContext);

  return React.cloneElement(render, {
    'aria-expanded': isOpen,
    'aria-controls': contentId,
    'data-open': isOpen || undefined,
    onClick: (e: React.MouseEvent) => {
      // Call any existing onClick on the render element
      const existingOnClick = (render.props as { onClick?: (e: React.MouseEvent) => void }).onClick;
      existingOnClick?.(e);
      toggle();
    },
  } as Record<string, unknown>);
}

SidebarCollapsibleTrigger.displayName = 'Sidebar.CollapsibleTrigger';

/**
 * Animated collapsible content panel. Uses CSS grid-rows for smooth
 * height transitions without measuring DOM height.
 *
 * Always mounted (no unmount on close) so exit animations play.
 */
export const SidebarCollapsibleContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<'div'>
>(({ className, children, onTransitionEnd, ...props }, ref) => {
  const {
    contentId,
    isOpen: isCollapsibleOpen,
    autoScrollOnOpen,
    completeOpenChange,
  } = useContext(SidebarCollapseContext);
  const sidebar = useSidebar();
  const { animationDuration } = sidebar;
  const contentRef = useRef<HTMLDivElement | null>(null);

  const isContentShown = isCollapsibleContentShown(isCollapsibleOpen, sidebar);

  useEffect(() => {
    if (!isContentShown || !autoScrollOnOpen) return;

    const timeout = window.setTimeout(() => {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      contentRef.current?.scrollIntoView({
        block: 'nearest',
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    }, animationDuration);

    return () => window.clearTimeout(timeout);
  }, [isContentShown, autoScrollOnOpen, animationDuration]);

  // Imperatively set inert — React 18 doesn't reliably forward
  // the inert attribute as a JSX prop on initial mount.
  const inertRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        if (!isContentShown) {
          node.setAttribute('inert', '');
        } else {
          node.removeAttribute('inert');
        }
      }
    },
    [isContentShown],
  );

  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      inertRef(node);
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [ref, inertRef],
  );

  const handleOpenTransitionEnd = useCallback(
    (event: React.TransitionEvent<HTMLDivElement>) => {
      onTransitionEnd?.(event);
      if (event.target === event.currentTarget && event.propertyName === 'grid-template-rows') {
        completeOpenChange();
      }
    },
    [completeOpenChange, onTransitionEnd],
  );

  return (
    <div
      ref={mergedRef}
      id={contentId}
      role="region"
      aria-hidden={!isContentShown}
      onTransitionEnd={handleOpenTransitionEnd}
      className={cn(
        'grid',
        'transition-[grid-template-rows] duration-(--sidebar-animation-duration) ease-(--sidebar-easing)',
        'motion-reduce:transition-none',
        isContentShown ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        className,
      )}
      {...props}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
});

SidebarCollapsibleContent.displayName = 'Sidebar.CollapsibleContent';

// ============================================================================
// Sidebar MenuChevron
// ============================================================================

/**
 * Auto-rotating chevron for collapsible menu items. Reads open state from
 * the nearest `SidebarCollapseContext` and rotates accordingly.
 *
 * @example
 * ```tsx
 * <Sidebar.CollapsibleTrigger
 *   render={<Sidebar.MenuButton icon={CodeIcon}>Compute<Sidebar.MenuChevron /></Sidebar.MenuButton>}
 * />
 * ```
 */
export function SidebarMenuChevron({ className }: { className?: string }) {
  const { isOpen, isCollapsible } = useContext(SidebarCollapseContext);

  return (
    <CaretRightIcon
      size={12}
      weight="bold"
      className={cn(
        'ml-auto shrink-0 opacity-40 transition-[transform,rotate,opacity] duration-200 group-hover/menu-button:opacity-100',
        isCollapsible && isOpen && 'rotate-90',
        // Hidden when sidebar is collapsed
        'group-data-[state=collapsed]/sidebar:hidden',
        className,
      )}
    />
  );
}

SidebarMenuChevron.displayName = 'Sidebar.MenuChevron';

// ============================================================================
// SlidingViews — animated horizontal transitions between navigation surfaces
