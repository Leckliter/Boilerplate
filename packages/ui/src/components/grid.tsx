'use client';

import React from 'react';
import { cn } from '../lib/utils';

const GRID_VARIANTS = {
  /** Stack on small screens, side by side from md. */
  '2up': 'grid-cols-1 md:grid-cols-2',
  /** Always two columns. */
  'side-by-side': 'grid-cols-2',
  /** Two-thirds / one-third from md. */
  '2-1': 'grid-cols-1 md:grid-cols-[2fr_1fr]',
  /** One-third / two-thirds from md. */
  '1-2': 'grid-cols-1 md:grid-cols-[1fr_2fr]',
  /** Stack, then 3 across from lg. */
  '1-3up': 'grid-cols-1 lg:grid-cols-3',
  /** 1, 2 at md, 3 at lg. */
  '3up': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  /** 1, 2 at md, 3 at lg, 4 at xl. */
  '4up': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  /** 2, 3 at md, 4 at lg, 6 at xl. */
  '6up': 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6',
  /** 1, 2 at md, 4 at lg. */
  '1-2-4up': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
} as const;

const GRID_GAPS = {
  none: 'gap-0',
  sm: 'gap-3',
  base: 'gap-2 md:gap-6 lg:gap-8',
  lg: 'gap-8',
} as const;

export type GridVariant = keyof typeof GRID_VARIANTS;
export type GridGap = keyof typeof GRID_GAPS;

/**
 * Grid component props.
 *
 * @example
 * ```tsx
 * <Grid variant="3up" gap="sm">
 *   <GridItem><Card className="p-4">1</Card></GridItem>
 *   <GridItem><Card className="p-4">2</Card></GridItem>
 *   <GridItem><Card className="p-4">3</Card></GridItem>
 * </Grid>
 * ```
 */
export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Grid items to render. */
  children?: React.ReactNode;
  /** Additional CSS classes merged via `cn()`. */
  className?: string;
  /** Show dividers between grid items on mobile (only works with `"4up"` variant). */
  mobileDivider?: boolean;
  /**
   * Gap size between grid items.
   * - `"none"` — No gap
   * - `"sm"` — 12px gap
   * - `"base"` — Responsive gap (8px → 24px → 32px)
   * - `"lg"` — 32px gap
   * @default "base"
   */
  gap?: GridGap;
  /**
   * Responsive column layout variant.
   * - `"2up"` — 1 col → 2 cols at md
   * - `"side-by-side"` — Always 2 cols
   * - `"2-1"` — 66%/33% split at md
   * - `"1-2"` — 33%/66% split at md
   * - `"3up"` — 1 → 2 → 3 cols
   * - `"4up"` — 1 → 2 → 3 → 4 cols
   * - `"6up"` — 2 → 3 → 4 → 6 cols
   * - `"1-2-4up"` — 1 → 2 → 4 cols
   */
  variant?: GridVariant;
}

/** GridItem component props — a single cell within a Grid. */
export interface GridItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Content for this grid cell. */
  children?: React.ReactNode;
  /** Additional CSS classes merged via `cn()`. */
  className?: string;
}

interface GridContextValue {
  variant?: GridVariant;
  gap: GridGap;
  mobileDivider?: boolean;
}

const GridContext = React.createContext<GridContextValue>({
  gap: 'base',
});

export function gridVariants({
  variant,
  gap = 'base',
}: {
  variant?: GridVariant;
  gap?: GridGap;
} = {}) {
  return cn(
    'grid',
    variant && (GRID_VARIANTS[variant] ?? GRID_VARIANTS['2up']),
    GRID_GAPS[gap] ?? GRID_GAPS.base,
  );
}

export function gridItemVariants({
  variant,
  mobileDivider,
}: {
  variant?: GridVariant;
  mobileDivider?: boolean;
} = {}) {
  return cn(
    mobileDivider && variant === '4up' && 'border-b border-hairline pb-8 md:border-b-0 md:pb-0',
  );
}

/**
 * Responsive CSS grid layout container with preset column configurations.
 *
 * @example
 * ```tsx
 * <Grid variant="2up" gap="base">
 *   <GridItem>Left</GridItem>
 *   <GridItem>Right</GridItem>
 * </Grid>
 * ```
 */
export const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  ({ children, className, mobileDivider, gap = 'base', variant, ...props }, ref) => {
    return (
      <GridContext.Provider value={{ variant, gap, mobileDivider }}>
        <div ref={ref} className={cn(gridVariants({ variant, gap }), className)} {...props}>
          {children}
        </div>
      </GridContext.Provider>
    );
  },
);

Grid.displayName = 'Grid';

export const GridItem = React.forwardRef<HTMLDivElement, GridItemProps>(
  ({ children, className, ...props }, ref) => {
    const { variant, mobileDivider } = React.useContext(GridContext);

    return (
      <div
        ref={ref}
        className={cn(gridItemVariants({ variant, mobileDivider }), className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);

GridItem.displayName = 'GridItem';
