import type * as React from 'react';

import { cn } from '../lib/utils';
import { TrendDownIcon, TrendUpIcon, MinusIcon } from './icons';

/**
 * A headline number with a label and, optionally, a change and a sparkline.
 * Server-safe. The change is never colour-only: it carries an arrow and words for screen readers.
 *
 *   <StatTile label="Revenue" value="$12,480" delta={{ value: '+8.2%', direction: 'up' }} />
 */
type StatDelta = {
  /** "+8.2%", "−3 orders". */
  value: string;
  direction: 'up' | 'down' | 'flat';
  /** Whether this direction is good news (a falling refund rate is good). Default: up is good. */
  good?: boolean;
  /** What the change is measured against: "vs last month". */
  period?: string;
};

const DIRECTION_WORD = { up: 'up', down: 'down', flat: 'unchanged' } as const;

function StatTile({
  label,
  value,
  delta,
  hint,
  icon,
  chart,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & {
  label: React.ReactNode;
  value: React.ReactNode;
  delta?: StatDelta;
  hint?: React.ReactNode;
  /** A decorative icon at the top right. */
  icon?: React.ReactNode;
  /** A `<Sparkline>` (or any small chart) shown under the number. */
  chart?: React.ReactNode;
}) {
  const good = delta ? (delta.good ?? delta.direction !== 'down') : true;
  const Arrow =
    delta?.direction === 'up'
      ? TrendUpIcon
      : delta?.direction === 'down'
        ? TrendDownIcon
        : MinusIcon;
  return (
    <div
      data-slot="stat-tile"
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-lg bg-card p-4 text-card-foreground shadow-xs ring ring-border',
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm text-muted-foreground">{label}</p>
        {icon && (
          <span aria-hidden className="shrink-0 text-muted-foreground [&>svg]:size-5">
            {icon}
          </span>
        )}
      </div>
      <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {delta && (
        <p
          className={cn(
            'flex flex-wrap items-center gap-x-1.5 text-sm',
            delta.direction === 'flat'
              ? 'text-muted-foreground'
              : good
                ? 'text-success'
                : 'text-destructive',
          )}
        >
          <Arrow aria-hidden className="size-4 shrink-0" />
          <span className="font-medium tabular-nums">
            <span className="sr-only">{DIRECTION_WORD[delta.direction]} </span>
            {delta.value}
          </span>
          {delta.period && <span className="text-muted-foreground">{delta.period}</span>}
        </p>
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {chart && <div className="pt-1">{chart}</div>}
    </div>
  );
}

export type { StatDelta };
export { StatTile };
