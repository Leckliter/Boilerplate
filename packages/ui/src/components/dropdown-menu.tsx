'use client';

import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import * as React from 'react';

import { cn } from '../lib/utils';
import { CaretRightIcon, CheckIcon, type Icon } from './icons';
import { usePortalContainer, type PortalContainer } from './kumo-context';

/**
 * Dropdown menu (Kumo look) on Base UI's Menu. The shadcn-style names
 * (`DropdownMenuItem` …) and Kumo's compound form (`DropdownMenu.Item` …) are both exported.
 * A `<DropdownMenuLabel>` must sit inside a `<DropdownMenuGroup>` (or RadioGroup).
 */

type ItemVariant = 'default' | 'danger' | 'destructive';
const DANGER =
  'text-destructive data-highlighted:bg-destructive/5 data-highlighted:text-destructive';

/** An icon prop may be a component (`CopyIcon`) or an element; it sits in an icon slot. */
function renderIconNode(icon?: Icon | React.ReactNode) {
  if (icon == null || icon === false) return null;
  let node: React.ReactNode;
  if (React.isValidElement<{ className?: string }>(icon)) {
    node = React.cloneElement(icon, { className: cn('size-4', icon.props.className) });
  } else if (
    typeof icon === 'function' ||
    (typeof icon === 'object' && '$$typeof' in (icon as object) && 'render' in (icon as object))
  ) {
    const Comp = icon as React.ComponentType<Record<string, unknown>>;
    node = <Comp className="size-4" />;
  } else {
    node = icon as React.ReactNode;
  }
  return (
    <span data-slot="dropdown-menu-icon" className="inline-flex shrink-0 items-center">
      {node}
    </span>
  );
}

/** Rows without an icon inset themselves when a sibling has one, so the text lines up. */
const autoInset =
  'group-has-[[data-slot=dropdown-menu-icon]]/menu:not-has-[[data-slot=dropdown-menu-icon]]:pl-8';

/** Shared layout and states of every selectable row. */
const menuRow = cn(
  'relative flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-base outline-hidden select-none',
  'focus:text-foreground focus-visible:ring-2 focus-visible:ring-primary',
  'data-highlighted:bg-tint',
  'data-disabled:pointer-events-none data-disabled:opacity-50',
  '[&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
  autoInset,
);

const POPUP_PADDING = 6;
type Side = MenuPrimitive.Positioner.Props['side'];
const isBlockSide = (side: Side) => side === 'top' || side === 'bottom';
const submenuSideOffset = ({ side }: { side: Side }) => (isBlockSide(side) ? 8 : 2);
const submenuAlignOffset = ({ side }: { side: Side }) => (isBlockSide(side) ? 0 : -POPUP_PADDING);

/** The menu root. */
function DropdownMenuRoot(props: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root {...props} />;
}
const DropdownMenuTrigger = MenuPrimitive.Trigger;
const DropdownMenuGroup = MenuPrimitive.Group;
const DropdownMenuSub = MenuPrimitive.SubmenuRoot;
const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

/** Moves the popup to the end of the body (or the PortalProvider container). */
function DropdownMenuPortal({
  container: containerProp,
  ...props
}: Omit<MenuPrimitive.Portal.Props, 'container'> & { container?: PortalContainer }) {
  const contextContainer = usePortalContainer();
  return (
    <MenuPrimitive.Portal container={containerProp ?? contextContainer ?? undefined} {...props} />
  );
}

function DropdownMenuPositioner({
  className,
  sideOffset = 8,
  ...props
}: MenuPrimitive.Positioner.Props) {
  return (
    <MenuPrimitive.Positioner
      data-slot="dropdown-menu-positioner"
      className={(state) =>
        cn('z-50 outline-hidden', typeof className === 'function' ? className(state) : className)
      }
      sideOffset={sideOffset}
      {...props}
    />
  );
}

/** The styled surface that holds the items. */
function DropdownMenuPopup({ className, ...props }: MenuPrimitive.Popup.Props) {
  return (
    <MenuPrimitive.Popup
      data-slot="dropdown-menu-content"
      className={(state) =>
        cn(
          'group/menu overflow-hidden bg-control text-foreground outline-hidden',
          'max-h-(--available-height) overflow-y-auto',
          'rounded-lg shadow-lg ring ring-border',
          'min-w-36 p-1.5',
          'origin-(--transform-origin) transition-[transform,scale,opacity] duration-150 motion-reduce:transition-none',
          'data-starting-style:scale-95 data-starting-style:opacity-0',
          'data-ending-style:scale-95 data-ending-style:opacity-0',
          'data-instant:duration-0',
          typeof className === 'function' ? className(state) : className,
        )
      }
      {...props}
    />
  );
}

type ContentProps = Omit<MenuPrimitive.Positioner.Props, 'className' | 'render'> & {
  container?: PortalContainer;
  /** Classes for the popup surface. */
  className?: string;
  children?: React.ReactNode;
};

/** Portal, positioner and popup in one. Positioning props go to the positioner, `className` to the popup. */
function DropdownMenuContent({
  className,
  children,
  container,
  sideOffset = 6,
  align = 'start',
  ...props
}: ContentProps) {
  return (
    <DropdownMenuPortal container={container}>
      <DropdownMenuPositioner sideOffset={sideOffset} align={align} {...props}>
        <DropdownMenuPopup className={className}>{children}</DropdownMenuPopup>
      </DropdownMenuPositioner>
    </DropdownMenuPortal>
  );
}

/** Popup of a nested menu: overlaps its parent a little and lines up with the SubTrigger. */
function DropdownMenuSubContent({
  sideOffset = submenuSideOffset,
  alignOffset = submenuAlignOffset,
  align,
  ...props
}: ContentProps) {
  return (
    <DropdownMenuContent
      sideOffset={sideOffset}
      alignOffset={alignOffset}
      align={align}
      {...props}
    />
  );
}

function DropdownMenuSubTrigger({
  className,
  inset,
  icon,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & { inset?: boolean; icon?: Icon | React.ReactNode }) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      className={(state) =>
        cn(
          menuRow,
          'data-popup-open:bg-tint',
          inset && 'pl-8',
          typeof className === 'function' ? className(state) : className,
        )
      }
      {...props}
    >
      {renderIconNode(icon)}
      {children}
      <CaretRightIcon className="ml-auto" />
    </MenuPrimitive.SubmenuTrigger>
  );
}

type RowProps = {
  /** Space for an icon, so rows without one line up with rows that have one. */
  inset?: boolean;
  icon?: Icon | React.ReactNode;
  /** `danger` (or `destructive`): red text for a destructive action. */
  variant?: ItemVariant;
};

/** One action. For navigation use `DropdownMenuLinkItem`. */
function DropdownMenuItem({
  className,
  variant = 'default',
  inset,
  icon,
  selected,
  children,
  ...props
}: MenuPrimitive.Item.Props & RowProps & { selected?: boolean }) {
  const hasContent = icon != null || selected || children != null;
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={(state) =>
        cn(
          menuRow,
          inset && 'pl-8',
          variant !== 'default' && DANGER,
          typeof className === 'function' ? className(state) : className,
        )
      }
      {...props}
    >
      {hasContent ? (
        <>
          {renderIconNode(icon)}
          {children}
          {selected && <CheckIcon className="ml-auto" />}
        </>
      ) : undefined}
    </MenuPrimitive.Item>
  );
}

/** A menu item that navigates. Pass `render={<Link href="…" />}` for client-side routing. */
function DropdownMenuLinkItem({
  className,
  variant = 'default',
  inset,
  icon,
  children,
  ...props
}: MenuPrimitive.LinkItem.Props & RowProps) {
  return (
    <MenuPrimitive.LinkItem
      data-slot="dropdown-menu-link-item"
      className={(state) =>
        cn(
          menuRow,
          'text-inherit no-underline',
          inset && 'pl-8',
          variant !== 'default' && DANGER,
          typeof className === 'function' ? className(state) : className,
        )
      }
      {...props}
    >
      {renderIconNode(icon)}
      {children}
    </MenuPrimitive.LinkItem>
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: MenuPrimitive.CheckboxItem.Props) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={(state) =>
        cn(
          menuRow,
          'pl-8 transition-colors',
          typeof className === 'function' ? className(state) : className,
        )
      }
      {...props}
    >
      <MenuPrimitive.CheckboxItemIndicator className="absolute left-2 flex size-3.5 items-center justify-center text-inherit">
        <CheckIcon weight="bold" size={12} />
      </MenuPrimitive.CheckboxItemIndicator>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

/** A heading inside a menu. It must sit inside <DropdownMenuGroup> or <DropdownMenuRadioGroup> (Base UI throws otherwise). */
function DropdownMenuLabel({
  className,
  inset,
  ...props
}: MenuPrimitive.GroupLabel.Props & { inset?: boolean }) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      className={(state) =>
        cn(
          'px-2 py-1.5 text-base font-semibold',
          autoInset,
          inset && 'pl-8',
          typeof className === 'function' ? className(state) : className,
        )
      }
      {...props}
    />
  );
}

/** One of several choices, inside a <DropdownMenuRadioGroup value onValueChange>. Shows a tick when chosen. */
function DropdownMenuRadioItem({
  className,
  children,
  inset,
  icon,
  ...props
}: MenuPrimitive.RadioItem.Props & { inset?: boolean; icon?: Icon | React.ReactNode }) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={(state) =>
        cn(
          menuRow,
          'pr-8',
          inset && 'pl-8',
          typeof className === 'function' ? className(state) : className,
        )
      }
      {...props}
    >
      {renderIconNode(icon)}
      {children}
      <DropdownMenuRadioItemIndicator className="absolute right-2" />
    </MenuPrimitive.RadioItem>
  );
}

function DropdownMenuRadioItemIndicator({
  className,
  children,
  ...props
}: MenuPrimitive.RadioItemIndicator.Props) {
  return (
    <MenuPrimitive.RadioItemIndicator
      className={(state) =>
        cn(
          'ml-auto flex items-center',
          typeof className === 'function' ? className(state) : className,
        )
      }
      {...props}
    >
      {children ?? <CheckIcon />}
    </MenuPrimitive.RadioItemIndicator>
  );
}

function DropdownMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={(state) =>
        cn(
          '-mx-1 my-1 h-px bg-hairline',
          typeof className === 'function' ? className(state) : className,
        )
      }
      {...props}
    />
  );
}

/** A right-aligned keyboard hint. */
function DropdownMenuShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn('ml-auto text-xs tracking-widest opacity-60', className)} {...props} />
  );
}

/** Class helper for dropdown-style rows built by hand. */
export function dropdownVariants({ variant = 'default' }: { variant?: ItemVariant } = {}) {
  return cn(variant !== 'default' && DANGER);
}

const DropdownMenu = Object.assign(DropdownMenuRoot, {
  Trigger: DropdownMenuTrigger,
  Portal: DropdownMenuPortal,
  Positioner: DropdownMenuPositioner,
  Popup: DropdownMenuPopup,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
  Content: DropdownMenuContent,
  Item: DropdownMenuItem,
  LinkItem: DropdownMenuLinkItem,
  CheckboxItem: DropdownMenuCheckboxItem,
  RadioGroup: DropdownMenuRadioGroup,
  RadioItem: DropdownMenuRadioItem,
  RadioItemIndicator: DropdownMenuRadioItemIndicator,
  Label: DropdownMenuLabel,
  Separator: DropdownMenuSeparator,
  Shortcut: DropdownMenuShortcut,
  Group: DropdownMenuGroup,
});

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuPopup,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRadioItemIndicator,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
