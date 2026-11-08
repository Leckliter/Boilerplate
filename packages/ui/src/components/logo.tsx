import { cn } from '../lib/utils';

/**
 * Placeholder wordmark. Replace the body with your own artwork (inline SVG paths take
 * their colour from tokens, so they follow light/dark mode) or keep the text version.
 */
export function Logo({
  name = 'App',
  compact = false,
  className,
}: {
  /** The product name shown as the wordmark. */
  name?: string;
  /** Just the mark (first letter) in a rounded square. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn('inline-flex items-center gap-2 font-semibold tracking-tight text-primary', className)}
      aria-label={name}
    >
      <span
        aria-hidden
        className="bg-primary text-primary-foreground inline-flex size-7 items-center justify-center rounded-lg text-sm"
      >
        {name.charAt(0).toUpperCase()}
      </span>
      {compact ? null : <span className="text-foreground text-base">{name}</span>}
    </span>
  );
}
