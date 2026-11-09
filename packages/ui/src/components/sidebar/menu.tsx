'use client';

import React, {
  type ComponentPropsWithoutRef,
  type ReactNode,
  createContext,
  forwardRef,
  useCallback,
  useContext,
} from 'react';

import { cn } from '../../lib/utils';
import { useLinkComponent } from '../ui-context';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import { useSidebar } from './provider';
import { unwrapLazyElement } from './shared';

const MenuItemContext = createContext(false);

/**
 * When `true`, indicates the component is already wrapped in a `MenuSubItem` `<li>`.
 * `MenuSubButton` checks this: if `false`, it auto-wraps itself in an `<li>`.
 */
const MenuSubItemContext = createContext(false);

// ============================================================================
// Sidebar Menu
// ============================================================================

/**
 * Navigation menu list. Renders as `<ul>`.
 *
 * `MenuButton` auto-wraps in `<li>` so `MenuItem` is optional for simple items.
 *
 * @example Simple usage
 * ```tsx
 * <Sidebar.Menu>
 *   <Sidebar.MenuButton icon={HouseIcon} active>Account home</Sidebar.MenuButton>
 *   <Sidebar.MenuButton icon={GlobeIcon}>Domains</Sidebar.MenuButton>
 * </Sidebar.Menu>
 * ```
 *
 * @example With explicit MenuItem (needed for Collapsible wrapper)
 * ```tsx
 * <Sidebar.Menu>
 *   <Sidebar.MenuItem>
 *     <Sidebar.Collapsible>...</Sidebar.Collapsible>
 *   </Sidebar.MenuItem>
 * </Sidebar.Menu>
 * ```
 */
export const SidebarMenu = forwardRef<HTMLUListElement, ComponentPropsWithoutRef<'ul'>>(
  ({ className, ...props }, ref) => (
    <ul
      ref={ref}
      data-sidebar="menu"
      className={cn('m-0 flex min-w-0 list-none flex-col items-stretch gap-y-px p-0', className)}
      {...props}
    />
  ),
);

SidebarMenu.displayName = 'Sidebar.Menu';

// ============================================================================
// Sidebar MenuItem
// ============================================================================

/**
 * Individual menu list item. Renders as `<li>`.
 *
 * **Optional when using `MenuButton` directly** — `MenuButton` auto-wraps
 * itself in a `<li>` when not already inside a `MenuItem`. Use `MenuItem`
 * explicitly when wrapping a `Collapsible`.
 *
 * @example Explicit usage (wrapping a Collapsible)
 * ```tsx
 * <Sidebar.MenuItem>
 *   <Sidebar.Collapsible>...</Sidebar.Collapsible>
 * </Sidebar.MenuItem>
 * ```
 */
export interface SidebarMenuItemProps extends ComponentPropsWithoutRef<'li'> {
  /** Anchor id for `useSidebar().scrollToItem(id)`. */
  itemId?: string;
}

export const SidebarMenuItem = forwardRef<HTMLLIElement, SidebarMenuItemProps>(
  ({ className, children, itemId, ...props }, ref) => {
    const { registerItem } = useSidebar();
    const setRef = useCallback(
      (node: HTMLLIElement | null) => {
        if (itemId) registerItem(itemId, node);
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLLIElement | null>).current = node;
        }
      },
      [itemId, ref, registerItem],
    );
    return (
      <MenuItemContext.Provider value={true}>
        <li
          ref={setRef}
          data-sidebar="menu-item"
          data-sidebar-item-id={itemId}
          className={cn('relative group-data-[state=collapsed]/sidebar:overflow-hidden', className)}
          {...props}
        >
          {children}
        </li>
      </MenuItemContext.Provider>
    );
  },
);

SidebarMenuItem.displayName = 'Sidebar.MenuItem';

// ============================================================================
// Sidebar MenuButton
// ============================================================================

export type SidebarMenuButtonSize = 'base' | 'sm';

export interface SidebarMenuButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'className' | 'children'
> {
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  active?: boolean;
  /**
   * Button size.
   * - `"base"` — Standard nav item
   * - `"sm"` — Compact nav item
   * @default "base"
   */
  size?: SidebarMenuButtonSize;
  href?: string;
  /** Link target — only meaningful when `href` is provided. */
  target?: React.HTMLAttributeAnchorTarget;
  tooltip?: string;
  /** Anchor id for `useSidebar().scrollToItem(id)`. */
  itemId?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * Primary interactive element inside a menu item. Renders as a `<button>` or link.
 * Supports icons, active state, and auto-tooltip when the sidebar is collapsed.
 *
 * **Auto-wraps in `<li>`** when not already inside a `Sidebar.MenuItem`.
 * Use `MenuItem` explicitly only when wrapping a `Collapsible`.
 *
 * @example Simple usage (auto-wrapped in `<li>`)
 * ```tsx
 * <Sidebar.Menu>
 *   <Sidebar.MenuButton icon={GlobeIcon} active>Domains</Sidebar.MenuButton>
 *   <Sidebar.MenuButton icon={ClockIcon} href="/recents">Recents</Sidebar.MenuButton>
 * </Sidebar.Menu>
 * ```
 *
 * @example With Collapsible (explicit MenuItem needed)
 * ```tsx
 * <Sidebar.MenuItem>
 *   <Sidebar.Collapsible>
 *     <Sidebar.CollapsibleTrigger render={<Sidebar.MenuButton icon={CodeIcon}>Compute<Sidebar.MenuChevron /></Sidebar.MenuButton>} />
 *     <Sidebar.CollapsibleContent>...</Sidebar.CollapsibleContent>
 *   </Sidebar.Collapsible>
 * </Sidebar.MenuItem>
 * ```
 */
export const SidebarMenuButton = forwardRef<HTMLButtonElement, SidebarMenuButtonProps>(
  (
    {
      className,
      icon: IconProp,
      active = false,
      size = 'base',
      href,
      target,
      tooltip,
      itemId,
      children,
      ...props
    },
    ref,
  ) => {
    const { state, peekable, registerItem } = useSidebar();
    const LinkComponent = useLinkComponent();
    const isInsideMenuItem = useContext(MenuItemContext);

    const registerAutoWrap = useCallback(
      (node: HTMLLIElement | null) => {
        if (itemId && !isInsideMenuItem) registerItem(itemId, node);
      },
      [itemId, isInsideMenuItem, registerItem],
    );

    // Explicit MenuItem parents don't carry the itemId, so the button IS the target.
    const registerInteractive = useCallback(
      (node: HTMLElement | null) => {
        if (itemId && isInsideMenuItem) registerItem(itemId, node);
        if (typeof ref === 'function') {
          ref(node as HTMLButtonElement | null);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLElement | null>).current = node;
        }
      },
      [itemId, isInsideMenuItem, ref, registerItem],
    );

    // Render icon — supports both component types and React elements
    const iconNode = (() => {
      const icon = unwrapLazyElement(IconProp);
      if (!icon) return null;
      if (React.isValidElement(icon)) return icon;
      const Comp = icon as React.ComponentType<{ className?: string }>;
      return (
        <Comp className={cn('shrink-0 opacity-40', size === 'base' ? 'size-4' : 'size-3.5')} />
      );
    })();

    const content = (
      <div
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3',
          'translate-x-[-3px] group-not-data-[state=collapsed]/sidebar:translate-x-0',
          'transition-transform duration-(--sidebar-animation-duration)',
        )}
      >
        {iconNode}
        <span className={cn('flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left')}>
          {React.Children.map(children, (child) =>
            typeof child === 'string' || typeof child === 'number' ? (
              <span className="truncate">{child}</span>
            ) : (
              child
            ),
          )}
        </span>
      </div>
    );

    const buttonClasses = cn(
      // Layout
      'group/menu-button relative flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-lg outline-none',
      'before:absolute before:inset-x-0 before:-inset-y-px',
      // Sizing
      size === 'base' && 'min-h-8.5 px-3 py-0 text-sm font-medium',
      size === 'sm' && 'min-h-7 px-2 py-0 text-sm',
      'text-foreground',
      'transition-[color,box-shadow,outline] duration-(--sidebar-animation-duration)',
      !active && 'hover:bg-(--sidebar-active-bg)',
      // Active state
      active && 'bg-(--sidebar-active-bg)',
      // When a child sub-button is active, don't show active styling on the parent trigger
      'has-[[data-active]]:bg-transparent has-[[data-active]]:hover:bg-(--sidebar-active-bg)',
      // Focus
      'focus:outline-hidden focus-visible:bg-(--sidebar-active-bg) focus-visible:text-foreground',
      className,
    );

    let button: React.ReactNode;

    // When inside an explicit SidebarMenuItem, `itemId` lands on the parent
    // <li>. When auto-wrapping below, it lands on the wrapper <li>. Either way
    // the DOM attribute is consistently on the <li>, matching SidebarMenuItem.
    const itemIdOnButton = isInsideMenuItem ? itemId : undefined;

    if (href) {
      button = (
        <LinkComponent
          ref={registerInteractive}
          {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
          className={cn(buttonClasses, 'no-underline!')}
          href={href}
          to={href}
          target={target}
          data-active={active || undefined}
          data-sidebar="menu-button"
          data-sidebar-item-id={itemIdOnButton}
          data-slot="sidebar-menu-button-link"
          data-size={size}
        >
          {content}
        </LinkComponent>
      );
    } else {
      button = (
        <button
          ref={registerInteractive}
          type="button"
          className={buttonClasses}
          data-active={active || undefined}
          data-sidebar="menu-button"
          data-sidebar-item-id={itemIdOnButton}
          data-slot="sidebar-menu-button"
          data-size={size}
          {...props}
        >
          {content}
        </button>
      );
    }

    // Always wrap in Tooltip when tooltip text is provided so the DOM
    // structure stays stable across expand/collapse — preventing React from
    // remounting the button (which would kill CSS transitions).
    // The tooltip popup only shows when collapsed and peeking is disabled —
    // when peekable, hovering reveals the full sidebar so tooltips are redundant.
    const showTooltip = state === 'collapsed' && !peekable;
    if (tooltip) {
      button = (
        <TooltipPrimitive.Root disabled={!showTooltip}>
          <TooltipPrimitive.Trigger render={button} />
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Positioner side="right" sideOffset={6} className="z-50">
              <TooltipPrimitive.Popup className="rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-sm transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0">
                {tooltip}
              </TooltipPrimitive.Popup>
            </TooltipPrimitive.Positioner>
          </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
      );
    }

    // Auto-wrap in <li> when not already inside a MenuItem
    if (!isInsideMenuItem) {
      return (
        <li
          ref={registerAutoWrap}
          data-sidebar="menu-item"
          data-sidebar-item-id={itemId}
          className="relative group-data-[state=collapsed]/sidebar:overflow-hidden"
        >
          {button}
        </li>
      );
    }

    return button;
  },
);

SidebarMenuButton.displayName = 'Sidebar.MenuButton';

// ============================================================================
// Sidebar MenuBadge
// ============================================================================

/**
 * Badge pill displayed inside a menu button (e.g., "Beta", "New").
 * Uses dashed border styling matching the Cloudflare design system.
 *
 * @example
 * ```tsx
 * <Sidebar.MenuSubButton>
 *   Containers
 *   <Sidebar.MenuBadge>Beta</Sidebar.MenuBadge>
 * </Sidebar.MenuSubButton>
 * ```
 */
export const SidebarMenuBadge = forwardRef<HTMLSpanElement, ComponentPropsWithoutRef<'span'>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      data-sidebar="menu-badge"
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border border-dashed border-border',
        'px-1.5 py-0.5 text-[11px]/none font-medium text-foreground select-none',
        // Hidden when collapsed
        'group-data-[state=collapsed]/sidebar:hidden',
        className,
      )}
      {...props}
    />
  ),
);

SidebarMenuBadge.displayName = 'Sidebar.MenuBadge';

// ============================================================================
// Sidebar MenuSub
// ============================================================================

/**
 * Indented sub-menu container for child navigation items. Renders as `<ul>` with
 * a left border accent for visual hierarchy.
 *
 * `MenuSubButton` auto-wraps in `<li>` so `MenuSubItem` is optional.
 *
 * @example
 * ```tsx
 * <Sidebar.MenuSub>
 *   <Sidebar.MenuSubButton active>Workers & Pages</Sidebar.MenuSubButton>
 *   <Sidebar.MenuSubButton>Durable Objects</Sidebar.MenuSubButton>
 * </Sidebar.MenuSub>
 * ```
 */
export const SidebarMenuSub = forwardRef<HTMLUListElement, ComponentPropsWithoutRef<'ul'>>(
  ({ className, children, ...props }, ref) => (
    <ul
      ref={ref}
      data-sidebar="menu-sub"
      className={cn(
        'relative m-0 flex min-w-0 list-none flex-col gap-y-px overflow-hidden p-0 pr-0 pl-7',
        className,
      )}
      {...props}
    >
      <li
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-px left-[19px] z-10 block w-px bg-border"
      />
      {children}
    </ul>
  ),
);

SidebarMenuSub.displayName = 'Sidebar.MenuSub';

// ============================================================================
// Sidebar MenuSubItem
// ============================================================================

/**
 * Individual item inside a sub-menu. Renders as `<li>`.
 *
 * **Optional when using `MenuSubButton` directly** — `MenuSubButton` auto-wraps
 * itself in a `<li>` when not already inside a `MenuSubItem`.
 */
export const SidebarMenuSubItem = forwardRef<HTMLLIElement, ComponentPropsWithoutRef<'li'>>(
  ({ className, children, ...props }, ref) => (
    <MenuSubItemContext.Provider value={true}>
      <li ref={ref} data-sidebar="menu-sub-item" className={cn('relative', className)} {...props}>
        {children}
      </li>
    </MenuSubItemContext.Provider>
  ),
);

SidebarMenuSubItem.displayName = 'Sidebar.MenuSubItem';

// ============================================================================
// Sidebar MenuSubButton
// ============================================================================

export interface SidebarMenuSubButtonProps extends ComponentPropsWithoutRef<'button'> {
  /** Marks this sub-item as currently active/selected. @default false */
  active?: boolean;
  /** Navigation URL. When set, renders as a link via LinkProvider. */
  href?: string;
  /** Link target — only meaningful when `href` is provided. */
  target?: React.HTMLAttributeAnchorTarget;
}

/**
 * Button inside a sub-menu item. Does not render an icon (sub-items are
 * indented instead). Supports active state and link rendering.
 *
 * **Auto-wraps in `<li>`** when not already inside a `Sidebar.MenuSubItem`.
 *
 * @example Simple usage (auto-wrapped in `<li>`)
 * ```tsx
 * <Sidebar.MenuSub>
 *   <Sidebar.MenuSubButton active>Workers & Pages</Sidebar.MenuSubButton>
 *   <Sidebar.MenuSubButton href="/observability">Observability</Sidebar.MenuSubButton>
 * </Sidebar.MenuSub>
 * ```
 */
export const SidebarMenuSubButton = forwardRef<HTMLButtonElement, SidebarMenuSubButtonProps>(
  ({ className, active = false, href, target, children, ...props }, ref) => {
    const LinkComponent = useLinkComponent();
    const isInsideMenuSubItem = useContext(MenuSubItemContext);

    const buttonClasses = cn(
      'group/menu-button relative flex min-h-8.5 w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-0 text-sm font-medium outline-none',
      'before:absolute before:inset-x-0 before:-inset-y-px',
      'text-foreground transition-[color] duration-150',
      !active && 'hover:bg-(--sidebar-active-bg)',
      active && 'bg-(--sidebar-active-bg)',
      'focus:outline-hidden focus-visible:bg-(--sidebar-active-bg) focus-visible:text-foreground',
      className,
    );

    const content = (
      <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left">
        {React.Children.map(children, (child) =>
          typeof child === 'string' || typeof child === 'number' ? (
            <span className="truncate">{child}</span>
          ) : (
            child
          ),
        )}
      </span>
    );

    let button: React.ReactNode;

    if (href) {
      button = (
        <LinkComponent
          ref={ref as React.Ref<HTMLAnchorElement>}
          {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
          className={cn(buttonClasses, 'no-underline!')}
          href={href}
          to={href}
          target={target}
          data-active={active || undefined}
          data-sidebar="menu-sub-button"
          data-slot="sidebar-menu-sub-button-link"
        >
          {content}
        </LinkComponent>
      );
    } else {
      button = (
        <button
          ref={ref}
          type="button"
          className={buttonClasses}
          data-active={active || undefined}
          data-sidebar="menu-sub-button"
          data-slot="sidebar-menu-sub-button"
          {...props}
        >
          {content}
        </button>
      );
    }

    // Auto-wrap in <li> when not already inside a MenuSubItem
    if (!isInsideMenuSubItem) {
      return (
        <li data-sidebar="menu-sub-item" className="relative">
          {button}
        </li>
      );
    }

    return button;
  },
);

SidebarMenuSubButton.displayName = 'Sidebar.MenuSubButton';

// ============================================================================
// Sidebar Separator
// ============================================================================
