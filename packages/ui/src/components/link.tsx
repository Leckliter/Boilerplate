import { cva } from 'class-variance-authority';

import { cn } from '../lib/utils';

/**
 * Link styles (server-safe: no hooks). The `Link` component with router support is in
 * `./link-component`; a link that looks like a button is `LinkButton` in `./link-button`.
 */

/** The focus ring every interactive thing uses (thin, neutral). */
export const focusRing =
  'outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring focus-visible:rounded-sm';

const toneVariants = cva(`underline-offset-4 transition-colors ${focusRing}`, {
  variants: {
    tone: {
      primary: 'font-medium text-primary hover:underline',
      inherit: 'hover:underline',
      muted: 'text-muted-foreground hover:text-foreground',
    },
  },
  defaultVariants: { tone: 'primary' },
});

/** Link variants (used by the `Link` component and `linkVariants({ variant })`). */
const LINK_VARIANTS = {
  /** Inline text link that flows with content. */
  inline:
    'text-link underline underline-offset-[0.15em] decoration-[0.0625em] decoration-[color-mix(in_oklch,currentColor_35%,transparent)] hover:decoration-current transition-colors',
  /** Inherits the colour of the surrounding text. */
  current:
    'text-current underline underline-offset-[0.15em] decoration-[0.0625em] decoration-[color-mix(in_oklch,currentColor_35%,transparent)] hover:decoration-current transition-colors',
  /** No underline. */
  plain: 'text-link hover:text-link/70 transition-colors',
} as const;

export type UiLinkVariant = keyof typeof LINK_VARIANTS;

/**
 * Text links. Put the classes on Next's <Link> (or an <a>):
 *   <Link href="/docs" className={linkVariants()}>Help</Link>
 * `tone` (app style):
 * - primary: brand colour, the default for a link in running text or a value.
 * - inherit: same colour as the text around it, underlines on hover (names in lists).
 * - muted: grey, darkens on hover (back links, secondary meta).
 * `variant`: inline | current | plain, as used by the `Link` component.
 */
export function linkVariants({
  tone,
  variant,
  className,
}: {
  tone?: 'primary' | 'inherit' | 'muted' | null;
  variant?: UiLinkVariant;
  className?: string;
} = {}) {
  if (variant) return cn(LINK_VARIANTS[variant], focusRing, className);
  return toneVariants({ tone, className });
}

export type LinkVariants = NonNullable<Parameters<typeof linkVariants>[0]>;

/**
 * Makes a whole table row (or list row) the link: put `rowLinkRow` on the
 * <TableRow> and `rowLink` on the one <Link> in it (usually the name).
 */
export const rowLinkRow = 'relative cursor-pointer hover:bg-tint even:hover:bg-tint';
export const rowLink = `after:absolute after:inset-0 ${focusRing}`;
