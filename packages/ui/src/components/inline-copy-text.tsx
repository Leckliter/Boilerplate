'use client';

/**
 * InlineCopyText — text that copies itself when clicked, with a copy icon that appears on
 * hover/focus and turns into a check for 1.5 s. the `inline-copy-text` pattern.
 *
 *   <InlineCopyText>ord_1Nx8Kq</InlineCopyText>
 *   <InlineCopyText variant="body" value="+18165550100">(816) 555-0100</InlineCopyText>
 */
import { forwardRef, useCallback, type ComponentPropsWithoutRef, type ReactNode } from 'react';

import { cn } from '../lib/utils';
import { useCopyFeedback } from '../lib/use-copy-feedback';
import { CheckIcon, CopySimpleIcon } from './icons';

const COPIED_FEEDBACK_MS = 1500;

type InlineCopyTextVariant = 'body' | 'secondary' | 'success' | 'error' | 'mono' | 'mono-secondary';
type InlineCopyTextSize = 'xs' | 'sm' | 'base' | 'lg';

const VARIANT: Record<InlineCopyTextVariant, string> = {
  body: 'text-foreground',
  secondary: 'text-muted-foreground',
  success: 'text-success',
  error: 'text-destructive',
  mono: 'font-mono text-foreground',
  'mono-secondary':
    'font-mono text-muted-foreground group-hover/inline-copy:text-foreground group-focus-visible/inline-copy:text-foreground',
};

const SIZE: Record<InlineCopyTextSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
};

function resolveCopyValue(children: ReactNode, value: string | undefined) {
  if (value !== undefined) return value;
  if (typeof children === 'string') return children;
  throw new Error('InlineCopyText requires a value prop when children is not a string.');
}

type InlineCopyTextProps = Omit<
  ComponentPropsWithoutRef<'button'>,
  'children' | 'onCopy' | 'value'
> & {
  /** Text style. Monospace by default (ids, keys, codes). */
  variant?: InlineCopyTextVariant;
  size?: InlineCopyTextSize;
  bold?: boolean;
  /** Cut long text with "…" (default). */
  truncate?: boolean;
  /** The element the text is rendered in. */
  as?: 'span' | 'p' | 'div';
  children: ReactNode;
  /** What gets copied; required when `children` is not a string. */
  value?: string;
  onCopy?: () => void;
  labels?: { copyAction?: string; copied?: string };
};

const InlineCopyText = forwardRef<HTMLButtonElement, InlineCopyTextProps>(
  (
    {
      children,
      value,
      variant = 'mono-secondary',
      size,
      bold,
      truncate = true,
      as: As = 'span',
      className,
      onClick,
      onCopy,
      labels: { copyAction = 'Copy to clipboard', copied: copiedLabel = 'Copied' } = {},
      ...props
    },
    ref,
  ) => {
    const { copied, runCopy } = useCopyFeedback(COPIED_FEEDBACK_MS);
    const valueToCopy = resolveCopyValue(children, value);
    const visibleText =
      typeof children === 'string' || typeof children === 'number' ? String(children) : valueToCopy;

    const copy = useCallback(async () => {
      const done = await runCopy(
        () => navigator.clipboard.writeText(valueToCopy),
        // Clipboard blocked (e.g. not HTTPS): the text is still on screen to select by hand.
        (error) => console.warn('Clipboard copy failed', error),
      );
      if (done) onCopy?.();
    }, [runCopy, valueToCopy, onCopy]);

    return (
      <button
        {...props}
        ref={ref}
        type="button"
        data-slot="inline-copy-text"
        className={cn(
          'group/inline-copy m-0 flex max-w-full min-w-0 cursor-pointer items-center gap-1 rounded-xs border-0 bg-transparent p-0 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden',
          className,
        )}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) void copy();
        }}
        // The visible text is the value, so the name contains it (WCAG 2.5.3): "Copy to clipboard: E-1234".
        aria-label={copied ? copiedLabel : `${copyAction}: ${visibleText}`}
      >
        <As
          className={cn(
            VARIANT[variant] ?? VARIANT['mono-secondary'],
            size ? SIZE[size] : variant.startsWith('mono') ? 'text-sm' : 'text-base',
            bold && 'font-semibold',
            truncate && 'min-w-0 truncate',
          )}
        >
          {children}
        </As>
        {copied ? (
          <CheckIcon aria-hidden className="size-3.5 shrink-0" />
        ) : (
          <CopySimpleIcon
            aria-hidden
            className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover/inline-copy:opacity-100 group-focus-visible/inline-copy:opacity-100 motion-reduce:transition-none"
          />
        )}
        <span className="sr-only" aria-live="polite">
          {copied ? copiedLabel : ''}
        </span>
      </button>
    );
  },
);
InlineCopyText.displayName = 'InlineCopyText';

export { InlineCopyText };
export type { InlineCopyTextProps, InlineCopyTextSize, InlineCopyTextVariant };
