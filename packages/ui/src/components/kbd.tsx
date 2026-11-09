import type * as React from 'react';

import { cn } from '../lib/utils';

/** A keyboard key: `<Kbd>⌘</Kbd><Kbd>K</Kbd>`, or `<KbdGroup keys={['Ctrl', 'K']} />`. */
function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-fill px-1.5 font-mono text-xs font-medium text-foreground ring ring-border',
        className,
      )}
      {...props}
    />
  );
}

function KbdGroup({
  keys,
  className,
  ...props
}: Omit<React.ComponentProps<'span'>, 'children'> & { keys: string[] }) {
  return (
    <span
      data-slot="kbd-group"
      className={cn('inline-flex items-center gap-1', className)}
      {...props}
    >
      {keys.map((k, i) => (
        <Kbd key={`${k}-${i}`}>{k}</Kbd>
      ))}
    </span>
  );
}

export { Kbd, KbdGroup };
