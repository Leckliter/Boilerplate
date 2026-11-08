import { Button as ButtonPrimitive } from '@base-ui/react/button';
import * as React from 'react';

import { cn } from '../lib/utils';
import { CircleNotchIcon, ArrowsClockwiseIcon, type Icon } from './icons';
import { Tooltip } from './tooltip';

/**
 * The one button (house look). This file has no hooks and no 'use client', so server
 * components can call `buttonVariants()` and render `<Button>` directly.
 * A link that looks like a button: `LinkButton` (./link-button) or `buttonVariants()` on <Link>.
 */

const SHAPES = {
  base: '',
  square: 'items-center justify-center p-0',
  circle: 'items-center justify-center rounded-full p-0',
} as const;

const SIZES = {
  xs: 'h-5 gap-1 rounded-sm px-1.5 text-xs',
  sm: 'h-6.5 gap-1 rounded-md px-2 text-xs',
  base: 'h-9 gap-1.5 rounded-lg px-3 text-base',
  lg: 'h-11 gap-2 rounded-lg px-4 text-base',
} as const;

const COMPACT_SIZES = {
  xs: 'size-5',
  sm: 'size-6.5',
  base: 'size-9',
  lg: 'size-11',
} as const;

const EMPHASIS =
  'relative overflow-hidden bg-(--ui-button-emphasis-bg) !text-white ring ring-(--ui-button-emphasis-ring) focus:ring-(--ui-button-emphasis-ring) focus-visible:ring-(--ui-button-emphasis-ring) active:ring-(--ui-button-emphasis-ring) disabled:opacity-50';

const VARIANTS = {
  /** High-emphasis: the main action on a screen (one per screen). */
  primary: EMPHASIS,
  /** Default style for most actions. */
  secondary:
    'bg-card !text-foreground ring not-disabled:hover:bg-tint disabled:bg-card/50 disabled:!text-foreground/70 ring-border data-[state=open]:bg-card',
  /** Minimal: no background until hovered. */
  ghost: 'bg-inherit text-foreground shadow-none hover:bg-tint',
  /** Danger: delete and other destructive actions. */
  destructive: EMPHASIS,
  /** Secondary look with destructive text, for a less prominent dangerous action. */
  'secondary-destructive':
    'bg-card !text-destructive ring not-disabled:hover:!text-destructive not-disabled:hover:ring-destructive/30 disabled:bg-card/50 disabled:!text-destructive/70 ring-border data-[state=open]:bg-card',
  /** Bordered with a transparent background. */
  outline:
    'bg-transparent text-foreground ring ring-border transition-colors not-disabled:hover:text-foreground not-disabled:hover:ring-ring/25',
  /** Looks like a text link (kept from the old Button). */
  link: 'h-auto bg-transparent px-0 text-primary shadow-none underline-offset-4 hover:underline',
} as const;

export type ButtonShape = keyof typeof SHAPES;
export type ButtonVariant = keyof typeof VARIANTS;
/** `md` is `base`; `icon` / `icon-sm` are square buttons (kept from the old Button). */
export type ButtonSize = keyof typeof SIZES | 'md' | 'icon' | 'icon-sm';

export interface ButtonVariantsProps {
  shape?: ButtonShape;
  size?: ButtonSize;
  variant?: ButtonVariant;
  className?: string;
}

function resolveSize(
  size: ButtonSize,
  shape: ButtonShape,
): { size: keyof typeof SIZES; shape: ButtonShape } {
  if (size === 'md') return { size: 'base', shape };
  if (size === 'icon') return { size: 'base', shape: shape === 'base' ? 'square' : shape };
  if (size === 'icon-sm') return { size: 'sm', shape: shape === 'base' ? 'square' : shape };
  return { size, shape };
}

/** The button classes, for a <Link> / <a> that should look like a button. */
export function buttonVariants({
  variant = 'secondary',
  size = 'base',
  shape = 'base',
  className,
}: ButtonVariantsProps = {}) {
  const resolved = resolveSize(size, shape);
  const compact = resolved.shape === 'square' || resolved.shape === 'circle';
  return cn(
    'group flex w-max shrink-0 items-center font-medium select-none',
    'border-0 shadow-xs',
    'cursor-pointer focus:ring-ring/50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary',
    'disabled:cursor-not-allowed disabled:text-muted-foreground aria-disabled:pointer-events-none aria-disabled:opacity-50 data-disabled:pointer-events-none',
    '[&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
    SIZES[resolved.size],
    SHAPES[resolved.shape],
    compact && COMPACT_SIZES[resolved.size],
    VARIANTS[variant],
    className,
  );
}

// Lowercase text sits below its line box's centre: lift the content row to centre it optically.
const TEXT_LIFT: Record<keyof typeof SIZES, string> = {
  xs: 'pb-px [--ui-button-text-lift:0.5px]',
  sm: 'pb-px [--ui-button-text-lift:0.5px]',
  base: 'pb-0.5 [--ui-button-text-lift:1px]',
  lg: 'pb-0.5 [--ui-button-text-lift:1px]',
};

// Icons carry whitespace inside their viewBox: trim the leading padding of icon + text buttons.
const ICON_LEADING_PADDING: Record<keyof typeof SIZES, string> = {
  xs: 'pl-1',
  sm: 'pl-1.5',
  base: 'pl-2.5',
  lg: 'pl-3.5',
};

const ICON_CENTER =
  '[&>svg:first-child]:translate-y-(--ui-button-text-lift) [&>span.relative>svg:first-child]:translate-y-(--ui-button-text-lift)';

/** Extra classes the Button / LinkButton add on top of `buttonVariants` for the text lift. */
export function buttonTextClasses(
  variant: ButtonVariant,
  size: ButtonSize,
  shape: ButtonShape,
  hasIcon: boolean,
  children: React.ReactNode,
) {
  const resolved = resolveSize(size, shape);
  const hasText = React.Children.toArray(children).some((child) => child !== '');
  if (resolved.shape !== 'base' || !hasText || variant === 'link') return undefined;
  return cn(
    TEXT_LIFT[resolved.size],
    hasIcon && [ICON_LEADING_PADDING[resolved.size], ICON_CENTER],
  );
}

/** An icon prop may be a component (`PlusIcon`) or an element (`<PlusIcon />`). */
export function renderButtonIcon(icon?: Icon | React.ReactNode) {
  if (icon == null || icon === false) return null;
  if (React.isValidElement(icon)) return icon;
  if (
    typeof icon === 'function' ||
    (typeof icon === 'object' && '$$typeof' in (icon as object) && 'render' in (icon as object))
  ) {
    const Comp = icon as React.ComponentType<Record<string, unknown>>;
    return <Comp />;
  }
  return icon as React.ReactNode;
}

const emphasisColor = (variant: ButtonVariant) =>
  variant === 'primary'
    ? 'var(--color-primary)'
    : variant === 'destructive'
      ? 'var(--color-destructive)'
      : undefined;

export function buttonEmphasisStyle(variant: ButtonVariant) {
  const token = emphasisColor(variant);
  if (!token) return undefined;
  return {
    '--ui-button-emphasis-ring': `color-mix(in oklch, ${token}, black 10%)`,
    '--ui-button-emphasis-bg': `color-mix(in oklch, ${token}, white 30%)`,
    '--ui-button-emphasis-gradient-start': `color-mix(in oklch, ${token}, white 15%)`,
    '--ui-button-emphasis-gradient-end': token,
  } satisfies React.CSSProperties & Record<`--${string}`, string>;
}

/** Inside of a button: the optional gradient (primary/destructive), the icon and the label. */
export function renderButtonContent(
  variant: ButtonVariant,
  iconNode: React.ReactNode,
  children: React.ReactNode,
) {
  const childNode = children != null ? <span className="contents">{children}</span> : null;
  if (!emphasisColor(variant)) {
    return (
      <>
        {iconNode}
        {childNode}
      </>
    );
  }
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-[inherit] bg-linear-to-b from-(--ui-button-emphasis-gradient-start) to-(--ui-button-emphasis-gradient-end) shadow-[inset_0_1px_0_0_var(--ui-button-emphasis-bg)] group-hover:from-(--ui-button-emphasis-bg)"
      />
      <span className="relative flex items-center gap-1.5">
        {iconNode}
        {childNode}
      </span>
    </>
  );
}

const titleLabel = (title: React.ReactNode) =>
  typeof title === 'string' ? title : typeof title === 'number' ? String(title) : undefined;

export type ButtonProps = Omit<ButtonPrimitive.Props, 'title'> & {
  /** Visual style. Default `secondary`. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** `square` / `circle` for icon-only buttons (give them an `aria-label` or `title`). */
  shape?: ButtonShape;
  /** Icon (component or element) rendered before the children. */
  icon?: Icon | React.ReactNode;
  /** Working on it: shows a spinner, blocks clicks, tells screen readers it's busy. */
  loading?: boolean;
  /** Shows as a tooltip (and is the accessible name of an icon-only button). */
  title?: React.ReactNode;
};

function Button({
  className,
  variant = 'secondary',
  size = 'base',
  shape = 'base',
  loading = false,
  disabled,
  icon,
  title,
  children,
  style,
  ref,
  type,
  ...props
}: ButtonProps & { ref?: React.Ref<HTMLElement> }) {
  const label = titleLabel(title);
  const ariaProps = {
    ...(!React.Children.count(children) &&
      !props['aria-label'] &&
      !props['aria-labelledby'] &&
      label && { 'aria-label': label }),
  };
  const iconNode = loading ? (
    <CircleNotchIcon className="animate-spin" aria-hidden />
  ) : (
    renderButtonIcon(icon)
  );
  const emphasis = buttonEmphasisStyle(variant);
  const isDisabled = Boolean(disabled || loading);
  // A plain string unless the caller passed a function: server components can't hand a function
  // to a client component, and most call sites pass a string (or nothing).
  const classesFor = (extra?: string) =>
    cn(
      buttonVariants({ variant, size, shape }),
      buttonTextClasses(variant, size, shape, iconNode != null, children),
      isDisabled && 'cursor-not-allowed opacity-50',
      extra,
    );
  const classes: ButtonPrimitive.Props['className'] =
    typeof className === 'function'
      ? (state) => classesFor(className(state))
      : classesFor(className);

  const button = (
    <ButtonPrimitive
      ref={ref}
      data-slot="button"
      className={classes}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      style={
        typeof style === 'function'
          ? (state) => ({ ...emphasis, ...style(state) })
          : emphasis
            ? { ...emphasis, ...style }
            : style
      }
      {...(type ? { type } : {})}
      {...ariaProps}
      {...props}
    >
      {renderButtonContent(variant, iconNode, children)}
    </ButtonPrimitive>
  );

  if (title && isDisabled) {
    return (
      <Tooltip content={title}>
        <span className="inline-flex">{button}</span>
      </Tooltip>
    );
  }
  if (title) return <Tooltip content={title}>{button}</Tooltip>;
  return button;
}

/**
 * An icon-only button. `aria-label` is REQUIRED by the type (no visible text, so it is the
 * only accessible name); it also shows as the tooltip unless `title` is given.
 */
export type IconButtonProps = Omit<ButtonProps, 'children' | 'icon' | 'shape' | 'aria-label'> & {
  icon: Icon | React.ReactNode;
  'aria-label': string;
  shape?: 'square' | 'circle';
};

function IconButton({ icon, shape = 'square', title, ...props }: IconButtonProps) {
  return <Button icon={icon} shape={shape} title={title ?? props['aria-label']} {...props} />;
}

/** Square button with a rotating-arrows icon, for "refresh the data". */
function RefreshButton({
  'aria-label': ariaLabel = 'Refresh',
  loading,
  size,
  ...props
}: Omit<ButtonProps, 'children' | 'icon' | 'shape' | 'loading'> & { loading?: boolean }) {
  return (
    <Button shape="square" size={size} aria-label={ariaLabel} {...props}>
      <ArrowsClockwiseIcon
        className={cn({
          'animate-spin': loading,
          'size-4.5': size === 'base' || size === 'md' || !size,
          'size-4': size === 'sm',
          'size-5': size === 'lg',
        })}
      />
    </Button>
  );
}

export { Button, IconButton, RefreshButton };
