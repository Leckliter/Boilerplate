import { cn } from '../lib/utils';

/**
 * Placeholder wordmark. Replace the body with your own artwork (inline SVG paths take
 * their colour from tokens, so they follow light/dark mode) or keep the text version.
 *
 * Accessible name: the product name is real text (visible, or `sr-only` when `compact`), so a link
 * or button around the Logo is named by it. Don't add `aria-label` on the Logo (a `<span>` can't
 * carry one). If the wrapping link needs its own `aria-label` it must start with / contain the
 * visible name ("Acme home"), or screen-reader and voice-control users get a mismatch (WCAG 2.5.3).
 *
 * `tone="onBrand"` is for brand-coloured backgrounds (`bg-primary`): the mark inverts so it stays
 * visible, and the wordmark uses the primary-foreground token.
 */
export function Logo({
  name = 'App',
  compact = false,
  tone = 'default',
  className,
}: {
  /** The product name shown as the wordmark. */
  name?: string;
  /** Just the mark (first letter) in a rounded square. */
  compact?: boolean;
  /** `onBrand` on a brand-coloured background (inverted mark, light wordmark). */
  tone?: 'default' | 'onBrand';
  className?: string;
}) {
  const onBrand = tone === 'onBrand';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 font-semibold tracking-tight',
        onBrand ? 'text-primary-foreground' : 'text-primary',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-sm',
          onBrand
            ? 'bg-primary-foreground text-primary ring-1 ring-primary-foreground/40'
            : 'bg-primary text-primary-foreground',
        )}
      >
        {name.charAt(0).toUpperCase()}
      </span>
      {compact ? (
        <span className="sr-only">{name}</span>
      ) : (
        <span className={cn('text-base', onBrand ? 'text-primary-foreground' : 'text-foreground')}>
          {name}
        </span>
      )}
    </span>
  );
}
