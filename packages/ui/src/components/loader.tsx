import { cn } from '../lib/utils';

/* Loader: a self-animating SVG spinner (no CSS needed). */

const SIZES = { sm: 16, base: 24, lg: 32 } as const;
type LoaderSize = keyof typeof SIZES;

interface LoaderProps {
  className?: string;
  /** sm (16), base (24), lg (32) or a number of pixels. */
  size?: LoaderSize | number;
  'aria-label'?: string;
}

function Loader({ className, size = 'base', 'aria-label': ariaLabel = 'Loading' }: LoaderProps) {
  const px = typeof size === 'number' ? size : (SIZES[size] ?? SIZES.base);
  return (
    <svg
      data-slot="loader"
      width={px}
      height={px}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      className={cn('shrink-0', className)}
      role="status"
      aria-label={ariaLabel}
    >
      <circle cx="12" cy="12" r="9.5" fill="none" strokeWidth="2" strokeLinecap="round">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="stroke-dasharray"
          values="0 150;42 150;42 150"
          keyTimes="0;0.5;1"
          dur="1.5s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="stroke-dashoffset"
          values="0;-16;-59"
          keyTimes="0;0.5;1"
          dur="1.5s"
          repeatCount="indefinite"
        />
      </circle>
      <circle
        cx="12"
        cy="12"
        r="9.5"
        fill="none"
        opacity={0.1}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The pixel size of a loader size name. */
function loaderVariants({ size = 'base' }: { size?: LoaderSize | number } = {}) {
  return typeof size === 'number' ? size : (SIZES[size] ?? SIZES.base);
}

export type { LoaderProps, LoaderSize };
export { Loader, loaderVariants };
