import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ElementRef,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
} from 'react';

import { cn } from '../lib/utils';

/*
 * Cloudflare Kumo's Text (MIT): the typography primitive. Pick a `variant`, optionally a `size`.
 * Escape hatches are named DANGEROUS_className / DANGEROUS_style on purpose; prefer a variant.
 */

const VARIANTS = {
  heading: 'text-lg font-semibold',
  /** Deprecated (use `heading`): kept for Kumo parity. */
  heading1: 'text-3xl font-semibold',
  heading2: 'text-2xl font-semibold',
  heading3: 'text-lg font-semibold',
  body: 'text-foreground',
  secondary: 'text-muted-foreground',
  success: 'text-link',
  error: 'text-destructive',
  mono: 'font-mono',
  'mono-secondary': 'font-mono text-muted-foreground',
} as const;

const SIZES = {
  xs: 'text-xs/[inherit]',
  sm: 'text-sm/[inherit]',
  base: 'text-base/[inherit]',
  lg: 'text-lg/[inherit]',
} as const;

type TextVariant = keyof typeof VARIANTS;
type TextSize = keyof typeof SIZES;
type TextElement =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'p'
  | 'span'
  | 'label'
  | 'dt'
  | 'dd'
  | 'li'
  | 'figcaption'
  | 'legend'
  | 'pre'
  | 'code'
  | 'em'
  | 'strong'
  | 'small'
  | 'abbr'
  | 'time';

const DEPRECATED_HEADINGS = ['heading1', 'heading2', 'heading3'];
const MONO = ['mono', 'mono-secondary'];
const COPY = ['body', 'secondary', 'success', 'error'];

function sizeClasses(variant: TextVariant, size: TextSize) {
  if (variant === 'heading') return size === 'lg' ? 'text-xl' : '';
  if (DEPRECATED_HEADINGS.includes(variant)) return '';
  // Mono text is one step smaller than body text.
  if (MONO.includes(variant)) return size === 'lg' ? SIZES.base : SIZES.sm;
  return SIZES[size] ?? SIZES.base;
}

/** The classes of a text style (for an element that can't be a `<Text>`). */
function textVariants({
  variant = 'body',
  size = 'base',
}: { variant?: TextVariant; size?: TextSize } = {}) {
  return cn(VARIANTS[variant] ?? VARIANTS.body, sizeClasses(variant, size));
}

interface TextProps extends Omit<
  ComponentPropsWithoutRef<'span'>,
  'className' | 'style' | 'color'
> {
  variant?: TextVariant;
  /** xs / sm / base / lg. Headings and mono text only take `lg`. */
  size?: TextSize;
  /** Medium weight (body, secondary, success, error only). */
  bold?: boolean;
  /** One line, ending in an ellipsis. */
  truncate?: boolean;
  /** The element to render (default: `p`; `span` for headings and mono). */
  as?: TextElement;
  children?: ReactNode;
  DANGEROUS_className?: string;
  DANGEROUS_style?: CSSProperties;
}

function TextImpl(
  {
    variant = 'body',
    bold = false,
    size = 'base',
    truncate = false,
    children,
    DANGEROUS_className,
    DANGEROUS_style,
    as,
    ...props
  }: TextProps,
  ref: ForwardedRef<HTMLElement>,
) {
  const Component: TextElement =
    as ??
    (MONO.includes(variant) || variant === 'heading' || DEPRECATED_HEADINGS.includes(variant)
      ? 'span'
      : 'p');
  const Tag = Component as 'span';
  return (
    <Tag
      ref={ref as ForwardedRef<HTMLSpanElement>}
      data-slot="text"
      className={cn(
        'text-foreground',
        VARIANTS[variant] ?? VARIANTS.body,
        sizeClasses(variant, size),
        COPY.includes(variant) && bold && 'font-medium',
        truncate && 'min-w-0 truncate',
        DANGEROUS_className,
      )}
      style={DANGEROUS_style}
      {...props}
    >
      {children}
    </Tag>
  );
}

const Text = forwardRef(TextImpl) as (
  props: TextProps & { ref?: ForwardedRef<ElementRef<'span'>> },
) => ReactElement;

export type { TextElement, TextProps, TextSize, TextVariant };
export { Text, textVariants };
