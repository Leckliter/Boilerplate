'use client';

import * as React from 'react';

import { cn } from '../lib/utils';

/** The one or two letters shown for a name ("Olivia Owner" → "OO"). Also useful in an accessible name. */
function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  );
}

/**
 * Initials avatar. Deterministic colour per name so people are recognisable in lists.
 * With `src` it shows that picture and falls back to the initials while it loads or if it fails.
 *
 * The avatar is decorative by default (the name is almost always printed next to it). Pass `alt`
 * to make it a labelled image instead (an avatar on its own, such as an account button).
 */
function Avatar({
  name,
  src,
  alt,
  className,
  style,
  ...props
}: Omit<React.ComponentProps<'span'>, 'children'> & {
  name: string;
  /** A picture of the person; the initials stay as the fallback. */
  src?: string | null;
  /** Accessible name when the avatar stands alone. Leave out when the name is shown beside it. */
  alt?: string;
}) {
  const [failed, setFailed] = React.useState<string | null>(null);
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
  const showImage = Boolean(src) && failed !== src;
  return (
    <span
      {...(alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': true })}
      data-slot="avatar"
      className={cn(
        'relative inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold',
        // Pastel in light mode, deep tint in dark mode; the hue comes from the name.
        'bg-[oklch(0.93_0.04_var(--avatar-hue))] text-[oklch(0.4_0.09_var(--avatar-hue))]',
        'dark:bg-[oklch(0.35_0.06_var(--avatar-hue))] dark:text-[oklch(0.88_0.06_var(--avatar-hue))]',
        className,
      )}
      style={{ ...style, ['--avatar-hue' as string]: hue }}
      {...props}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- a plain <img>: the UI package has no Next dependency
        <img src={src!} alt="" className="size-full object-cover" onError={() => setFailed(src!)} />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}

export { Avatar, initialsOf };
