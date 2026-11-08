import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '../lib/utils';

export interface ButtonGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
  className?: string;
  /** The tightly-coupled controls to join, typically a primary action and a dropdown trigger (a "split button"). */
  children?: ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Joins a small set of tightly-coupled buttons into one control, most commonly a
 * split button. Children keep their own variant/size/shape; the group flattens the
 * inner corners and overlaps the seams. Pair with an `aria-label`.
 * For independent controls (a formatting bar) use `Toolbar`.
 */
export function ButtonGroup({ className, children, ref, ...props }: ButtonGroupProps) {
  return (
    <div
      {...props}
      ref={ref}
      role="group"
      data-slot="button-group"
      className={cn(
        // `isolate` contains child z-index; `w-max` shrinks the group to its content.
        'relative isolate inline-flex w-max flex-row',
        // Every child gets a stacking context so a focused control lifts above the seam.
        '[&>*]:relative [&>*:focus-visible]:z-10 [&>*:has(:focus-visible)]:z-10',
        // Per-button shadows overlap at the seams: drop them so the group reads as one control.
        '[&>*>:is(button,a)]:shadow-none [&>:is(button,a)]:shadow-none',
        // Join by child position (mixed Button / LinkButton groups, tooltip-wrapped buttons).
        '[&>*:not(:first-child):is(button,a)]:rounded-s-none',
        '[&>*:is(button,a):has(~_:is(button,a))]:rounded-e-none',
        '[&>*:not(:first-child)>:is(button,a)]:rounded-s-none',
        '[&>*:not(:last-child)>:is(button,a)]:rounded-e-none',
        // Overlap rings by 1px so neighbours share one seam (logical, so RTL works).
        '[&>*:not(:first-child)]:-ms-px',
        className,
      )}
    >
      {children}
    </div>
  );
}
