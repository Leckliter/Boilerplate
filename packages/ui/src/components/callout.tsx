import type * as React from 'react';

import { cn } from '../lib/utils';
import { Banner, bannerVariants, type BannerVariant } from './banner';

/**
 * A coloured notice: "needs attention", "payment failed", "you don't have access".
 * Use `<Callout>` for a box, or `calloutVariants()` to style a Link the same way.
 * `shape="banner"` is a full-width strip across the top of a page. Built on Banner.
 */
type CalloutTone = 'warning' | 'danger' | 'info' | 'success' | 'loud';
type CalloutShape = 'box' | 'banner' | 'strip';

const TONE_TO_VARIANT: Record<Exclude<CalloutTone, 'loud'>, BannerVariant> = {
  warning: 'alert',
  danger: 'error',
  info: 'default',
  success: 'success',
};

const SHAPES: Record<CalloutShape, string> = {
  box: 'px-4 py-3',
  banner: 'rounded-none px-4 py-2',
  strip: 'justify-center rounded-none px-4 py-1 text-center text-xs font-semibold tracking-wide',
};

/** The classes of a callout (for a Link or anything that should look like one). */
function calloutVariants({
  tone = 'warning',
  shape = 'box',
}: { tone?: CalloutTone | null; shape?: CalloutShape | null } = {}) {
  const t = tone ?? 'warning';
  return cn(
    t === 'loud'
      ? // Loud and solid: the "this is the test site" strip.
        'flex w-full items-center gap-2 bg-badge-orange text-sm text-black'
      : bannerVariants({ variant: TONE_TO_VARIANT[t], size: 'sm' }),
    '[&_svg]:size-4 [&_svg]:shrink-0',
    SHAPES[shape ?? 'box'],
  );
}

type CalloutProps = Omit<React.ComponentProps<'div'>, 'title'> & {
  tone?: CalloutTone | null;
  shape?: CalloutShape | null;
};

function Callout({ className, tone, shape, children, ...props }: CalloutProps) {
  const t = tone ?? 'warning';
  const role = t === 'danger' ? 'alert' : 'status';
  if (t === 'loud') {
    return (
      <div
        data-slot="callout"
        role={role}
        className={cn(calloutVariants({ tone: t, shape }), className)}
        {...props}
      >
        {children}
      </div>
    );
  }
  return (
    <Banner
      data-slot="callout"
      role={role}
      variant={TONE_TO_VARIANT[t]}
      size="sm"
      className={cn('[&_svg]:size-4 [&_svg]:shrink-0', SHAPES[shape ?? 'box'], className)}
      {...props}
    >
      {children}
    </Banner>
  );
}

export type { CalloutProps, CalloutShape, CalloutTone };
export { Callout, calloutVariants };
