import type * as React from 'react';

import { cn } from '../lib/utils';

/*
 * Cloudflare Kumo's Badge (MIT), kept compatible with our tag colours.
 * Use `variant` (Kumo's names) or `color` (our tag-colour keys, which map onto Kumo's variants).
 */

/** Colour keys a tag can use (stored on the tag row in the database). */
export const TAG_COLORS = [
  'neutral',
  'brand',
  'blue',
  'green',
  'amber',
  'red',
  'purple',
  'teal',
] as const;
export type TagColor = (typeof TAG_COLORS)[number];

const BASE =
  'inline-flex w-fit flex-none shrink-0 items-center justify-self-start gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap [a:hover_&]:ring [a:hover_&]:ring-current';

/** Kumo's badge variants → classes. */
const VARIANTS = {
  primary: 'bg-badge-inverted text-badge-inverted-foreground',
  secondary: 'bg-fill text-badge-neutral-subtle',
  error: 'bg-destructive-tint text-destructive',
  warning: 'bg-warning-tint text-warning',
  success: 'bg-success-tint text-success',
  info: 'bg-info-tint text-info',
  beta: 'border border-dashed border-primary bg-transparent text-link',
  outline: 'border border-fill bg-card text-foreground',
  red: 'bg-badge-red text-white',
  green: 'bg-badge-green text-white',
  neutral: 'bg-badge-neutral text-white',
  orange: 'bg-badge-orange text-black',
  purple: 'bg-badge-purple text-white',
  teal: 'bg-badge-teal text-white',
  'teal-subtle': 'bg-badge-teal-subtle/15 text-badge-teal-subtle',
  blue: 'bg-badge-blue text-white',
  /** Our own: the brand colour, solid. */
  solid: 'bg-primary text-primary-foreground',
} as const;

type BadgeVariant = keyof typeof VARIANTS;
type BadgeAppearance = 'filled' | 'dot';

const DOT_COLORS: Partial<Record<BadgeVariant, string>> = {
  success: 'bg-success',
  warning: 'bg-badge-orange',
  error: 'bg-badge-red',
  neutral: 'bg-badge-neutral',
};

/** Our tag-colour keys → Kumo variants. */
const COLOR_TO_VARIANT = {
  neutral: 'secondary',
  brand: 'primary',
  blue: 'info',
  green: 'success',
  amber: 'warning',
  red: 'error',
  purple: 'purple',
  teal: 'teal-subtle',
  solid: 'solid',
  outline: 'outline',
} as const satisfies Record<string, BadgeVariant>;

type BadgeColor = keyof typeof COLOR_TO_VARIANT;

/** The classes of a badge (use on a Link or anything that should look like one). */
function badgeVariants({
  variant = 'primary',
  appearance = 'filled',
}: { variant?: BadgeVariant; appearance?: BadgeAppearance } = {}) {
  return cn(
    BASE,
    // The dot appearance replaces the variant's colours.
    appearance === 'dot'
      ? 'gap-1.5 bg-transparent text-foreground ring ring-hairline'
      : (VARIANTS[variant] ?? VARIANTS.primary),
  );
}

type BadgeProps = Omit<React.ComponentProps<'span'>, 'color'> & {
  /** Kumo's variant. Wins over `color`. Default `primary` (inverted) unless `color` is given. */
  variant?: BadgeVariant;
  /** Our tag-colour keys (neutral, brand, blue, green, amber, red, purple, teal, solid, outline). */
  color?: BadgeColor;
  /** `dot` is an outlined badge with a status dot (success, warning, error, neutral variants). */
  appearance?: BadgeAppearance;
  /** An icon element shown before the text (not with `appearance="dot"`). */
  icon?: React.ReactNode;
};

function Badge({
  className,
  color,
  variant,
  appearance = 'filled',
  icon,
  children,
  ...props
}: BadgeProps) {
  // No colour at all = the quiet neutral badge our screens have always used.
  const resolved: BadgeVariant =
    variant && variant in VARIANTS
      ? variant
      : isBadgeColor(color)
        ? COLOR_TO_VARIANT[color]
        : 'secondary';
  const dot = appearance === 'dot' ? DOT_COLORS[resolved] : undefined;
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant: resolved, appearance }), icon && 'pl-1.5', className)}
      {...props}
    >
      {dot && <span aria-hidden className={cn('size-1.75 shrink-0 rounded-full', dot)} />}
      {icon && appearance !== 'dot' && (
        <span className="flex h-lh w-3 shrink-0 items-center justify-center [&>svg]:size-3">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}

/** A colour stored as text (a tag's `color` column) → a Badge colour, neutral if unknown. */
function tagColor(c: string | null | undefined): BadgeColor {
  return isBadgeColor(c) ? c : 'neutral';
}

function isBadgeColor(c: unknown): c is BadgeColor {
  return typeof c === 'string' && c in COLOR_TO_VARIANT;
}

/**
 * A small number on an icon (unread notifications, items in the cart).
 * Pass the accessible text yourself on the parent (e.g. aria-label="Cart, 2 items").
 */
function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      data-slot="count-badge"
      className={cn(
        'inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] leading-none font-semibold text-primary-foreground tabular-nums',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export type { BadgeColor, BadgeProps, BadgeVariant };
export { Badge, badgeVariants, CountBadge, tagColor };
