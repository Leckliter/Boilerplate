'use client';

import { useId, type CSSProperties } from 'react';

import { cn } from '../lib/utils';

/*
 * SkeletonLine: a loading bar with a sliding shimmer, random width
 * so a stack of them looks like text. Needs the `shimmer` keyframes in globals.css.
 */

type SkeletonLineVariant = 'default' | 'sketch';

const SHIMMER =
  'animate-[shimmer_var(--shimmer-duration,1.5s)_var(--shimmer-delay,0s)_infinite_ease-in-out] motion-reduce:animate-none';
const STROKE = 'absolute bg-fill';

/**
 * A number in [0, 1) that stays the same between the server render and hydration
 * (Math.random() would differ and React would warn), but differs from bar to bar.
 */
function seeded(id: string, salt: number) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

interface SkeletonLineProps {
  variant?: SkeletonLineVariant;
  /** Width range, in percent. */
  minWidth?: number;
  maxWidth?: number;
  /** Shimmer duration / delay range, in seconds. */
  minDuration?: number;
  maxDuration?: number;
  minDelay?: number;
  maxDelay?: number;
  /** Wrap the bar in a box this tall, so it lines up with real text (e.g. `20` or `"1.5rem"`). */
  blockHeight?: string | number;
  className?: string;
}

function SkeletonLine({
  variant = 'default',
  minWidth = 30,
  maxWidth = 100,
  minDuration = 1.3,
  maxDuration = 1.7,
  minDelay = 0,
  maxDelay = 0.5,
  blockHeight,
  className,
}: SkeletonLineProps) {
  // Looks random, but comes from the element's id so server and client agree.
  const id = useId();
  const pick = (min: number, max: number, salt: number) => seeded(id, salt) * (max - min) + min;
  const rand = {
    width: Math.floor(pick(minWidth, maxWidth + 1, 1)),
    duration: pick(minDuration, maxDuration, 2).toFixed(2),
    delay: pick(minDelay, maxDelay, 3).toFixed(2),
  };
  const style = {
    '--skeleton-width': `${rand.width}%`,
    '--shimmer-duration': `${rand.duration}s`,
    '--shimmer-delay': `${rand.delay}s`,
  } as CSSProperties;

  const line =
    variant === 'sketch' ? (
      <div
        data-slot="skeleton-line"
        data-variant="sketch"
        className={cn('relative h-2 w-(--skeleton-width)', className)}
        style={style}
      >
        <div className="absolute inset-0 overflow-hidden rounded-lg bg-recessed">
          <div
            className={cn(
              'absolute inset-0 bg-linear-to-r from-transparent via-contrast/8 to-transparent',
              SHIMMER,
            )}
          />
        </div>
        {/* Construction strokes along each edge, 4px past every corner. */}
        <div className={cn(STROKE, '-inset-x-1 top-0 h-px')} />
        <div className={cn(STROKE, '-inset-x-1 bottom-0 h-px')} />
        <div className={cn(STROKE, '-inset-y-1 left-0 w-px')} />
        <div className={cn(STROKE, '-inset-y-1 right-0 w-px')} />
        <div className="absolute inset-0 rounded-lg border border-interact" />
      </div>
    ) : (
      <div
        data-slot="skeleton-line"
        className={cn(
          'relative h-2 w-(--skeleton-width) max-w-full overflow-hidden rounded-xs bg-fill',
          "after:absolute after:inset-0 after:bg-linear-to-r after:from-transparent after:via-contrast/8 after:to-transparent after:content-['']",
          'after:animate-[shimmer_var(--shimmer-duration,1.5s)_var(--shimmer-delay,0s)_infinite_ease-in-out] motion-reduce:after:animate-none',
          className,
        )}
        style={style}
      />
    );

  if (blockHeight === undefined) return line;
  return (
    <div
      className="flex items-center"
      style={{ height: typeof blockHeight === 'number' ? `${blockHeight}px` : blockHeight }}
    >
      {line}
    </div>
  );
}

export type { SkeletonLineProps, SkeletonLineVariant };
export { SkeletonLine };
