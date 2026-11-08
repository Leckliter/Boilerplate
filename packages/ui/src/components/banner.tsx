'use client';

import {
  createContext,
  forwardRef,
  isValidElement,
  useContext,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { cn } from '../lib/utils';
import { Button, type ButtonProps } from './button';

/*
 * Banner: a tinted notice with an optional icon, title,
 * description and action. `success` is our own addition.
 * For the plain "needs attention" box used across the screens, see `Callout`.
 */

const VARIANTS = {
  default: { classes: 'bg-info-tint text-info', icon: 'fill-info' },
  alert: { classes: 'bg-warning-tint text-warning', icon: 'fill-warning' },
  error: { classes: 'bg-destructive-tint text-destructive', icon: 'fill-destructive' },
  secondary: { classes: 'bg-contrast/5 text-foreground/70', icon: 'fill-interact' },
  success: { classes: 'bg-success-tint text-success', icon: 'fill-success' },
} as const;

const SIZES = {
  base: { classes: 'items-start gap-3 rounded-lg px-4 py-3 text-base' },
  sm: { classes: 'items-center gap-2 rounded-md px-3 py-2 text-sm' },
} as const;

const SIZE_PARTS = {
  base: { row: 'gap-3', icon: 'h-[1.375em]', action: 'sm' },
  sm: { row: 'gap-2', icon: 'h-[1.25em]', action: 'xs' },
} as const;

type BannerVariant = keyof typeof VARIANTS;
type BannerSize = keyof typeof SIZES;

/** The classes of a banner (for anything that should look like one). */
function bannerVariants({
  variant = 'default',
  size = 'base',
}: { variant?: BannerVariant; size?: BannerSize } = {}) {
  return cn(
    'flex w-full',
    (VARIANTS[variant] ?? VARIANTS.default).classes,
    (SIZES[size] ?? SIZES.base).classes,
  );
}

/* ── Banner.Action ─────────────────────────────────────────────────── */

type BannerActionVariant = 'primary' | 'secondary' | 'ghost';

const ActionContext = createContext<{ variant: BannerVariant; size: 'xs' | 'sm' }>({
  variant: 'default',
  size: 'sm',
});

const ACTION_TINTS: Record<BannerVariant, { secondary: string; ghost: string }> = {
  default: {
    secondary: 'text-inherit border-info/50 hover:bg-info/10',
    ghost: 'text-inherit hover:bg-info/10',
  },
  alert: {
    secondary: 'text-inherit border-warning/50 hover:bg-warning/10',
    ghost: 'text-inherit hover:bg-warning/10',
  },
  error: {
    secondary: 'text-inherit border-destructive/50 hover:bg-destructive/10',
    ghost: 'text-inherit hover:bg-destructive/10',
  },
  secondary: {
    secondary: 'text-inherit border-ring/20 hover:bg-contrast/10',
    ghost: 'text-inherit hover:bg-contrast/10',
  },
  success: {
    secondary: 'text-inherit border-success/50 hover:bg-success/10',
    ghost: 'text-inherit hover:bg-success/10',
  },
};

type BannerActionProps = Omit<ButtonProps, 'size' | 'variant'> & { variant?: BannerActionVariant };

/** The call-to-action button of a banner; sized and tinted to match it. */
const BannerAction = forwardRef<HTMLButtonElement, BannerActionProps>(function BannerAction(
  { variant = 'primary', className, ...props },
  ref,
) {
  const banner = useContext(ActionContext);
  const tint = ACTION_TINTS[banner.variant];
  return (
    <Button
      ref={ref}
      variant={variant === 'secondary' ? 'outline' : variant}
      size={banner.size}
      className={cn(variant !== 'primary' && tint[variant], className)}
      {...props}
    />
  );
});
BannerAction.displayName = 'Banner.Action';

/* ── Banner ────────────────────────────────────────────────────────── */

interface BannerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'title'> {
  /** An icon element (Phosphor), tinted to match the variant. */
  icon?: ReactNode;
  title?: string;
  description?: ReactNode;
  /** A button or link on the right, usually `<Banner.Action>`. */
  action?: ReactNode;
  /** Plain-text shorthand for `children`. */
  text?: string;
  children?: ReactNode;
  /** default (info), alert (warning), error, secondary (neutral), success. */
  variant?: BannerVariant;
  /** `base`, or `sm` for dialogs and tight spaces. */
  size?: BannerSize;
}

const BannerRoot = forwardRef<HTMLDivElement, BannerProps>(function BannerRoot(
  {
    icon,
    title,
    description,
    action,
    children,
    text,
    variant = 'default',
    size = 'base',
    className,
    ...props
  },
  ref,
) {
  const config = VARIANTS[variant] ?? VARIANTS.default;
  const parts = SIZE_PARTS[size] ?? SIZE_PARTS.base;
  const compact = size === 'sm';
  const context = { variant, size: parts.action } as const;

  // Structured: title and/or description.
  if (title || description) {
    return (
      <ActionContext.Provider value={context}>
        <div ref={ref} className={cn(bannerVariants({ variant, size }), className)} {...props}>
          {icon && (
            <span className={cn('flex shrink-0 items-center', parts.icon, config.icon)}>
              {icon}
            </span>
          )}
          <div
            className={cn(
              'flex min-w-0 flex-1 flex-wrap items-center justify-between',
              parts.row,
              !title && 'pt-px',
            )}
          >
            {compact ? (
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
                {title && <span className="leading-snug font-medium">{title}</span>}
                {description && <span className="text-sm leading-snug">{description}</span>}
              </div>
            ) : (
              <div className="flex min-w-0 flex-col gap-0.5">
                {title && <p className="leading-snug font-medium">{title}</p>}
                {description && (
                  <div className="text-sm leading-snug">
                    {isValidElement(description) ? description : <p>{description}</p>}
                  </div>
                )}
              </div>
            )}
            {action != null && <div className="flex shrink-0 items-center gap-2">{action}</div>}
          </div>
        </div>
      </ActionContext.Provider>
    );
  }

  // Free-form: children (or `text`). A bare string becomes a paragraph; anything else renders as given.
  const value = children ?? text;
  const content = typeof value === 'string' ? <p>{value}</p> : value;
  return (
    <ActionContext.Provider value={context}>
      <div ref={ref} className={cn(bannerVariants({ variant, size }), className)} {...props}>
        {icon && <span className={cn('shrink-0', config.icon)}>{icon}</span>}
        {content}
      </div>
    </ActionContext.Provider>
  );
});
BannerRoot.displayName = 'Banner';

const Banner = Object.assign(BannerRoot, { Action: BannerAction });

export type { BannerActionProps, BannerActionVariant, BannerProps, BannerSize, BannerVariant };
export { Banner, BannerAction, bannerVariants };
