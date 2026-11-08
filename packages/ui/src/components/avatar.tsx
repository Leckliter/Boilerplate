import type * as React from 'react';

import { cn } from '../lib/utils';

/** Initials avatar. Deterministic colour per name so people are recognisable in lists. */
function Avatar({
  name,
  className,
  style,
  ...props
}: Omit<React.ComponentProps<'span'>, 'children'> & { name: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?';
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
  return (
    <span
      aria-hidden
      data-slot="avatar"
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        // Pastel in light mode, deep tint in dark mode; the hue comes from the name.
        'bg-[oklch(0.93_0.04_var(--avatar-hue))] text-[oklch(0.4_0.09_var(--avatar-hue))]',
        'dark:bg-[oklch(0.35_0.06_var(--avatar-hue))] dark:text-[oklch(0.88_0.06_var(--avatar-hue))]',
        className,
      )}
      style={{ ...style, ['--avatar-hue' as string]: hue }}
      {...props}
    >
      {initials}
    </span>
  );
}

export { Avatar };
