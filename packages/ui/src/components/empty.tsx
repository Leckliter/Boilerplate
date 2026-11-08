'use client';

import { useCallback, type ReactNode } from 'react';

import { useCopyFeedback } from '../lib/use-copy-feedback';
import { cn } from '../lib/utils';
import { Button } from './button';
import { CheckIcon, CopyIcon } from './icons';
import { Text } from './text';

/*
 * Cloudflare Kumo's Empty (MIT): "nothing here yet" with an optional icon, a description,
 * a copyable command and free-form `contents` (buttons).
 */

const SIZES = {
  sm: 'gap-4 px-6 py-8',
  base: 'gap-6 px-10 py-16',
  lg: 'gap-8 px-12 py-20',
} as const;
type EmptySize = keyof typeof SIZES;

/** The classes of the empty-state box. */
function emptyVariants({ size = 'base' }: { size?: EmptySize } = {}) {
  return cn(
    'flex w-full flex-col items-center rounded-xl border border-fill bg-control text-center text-foreground',
    SIZES[size] ?? SIZES.base,
  );
}

interface EmptyProps {
  /** An icon element shown above the title; it is muted and sized (32px) for you. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** A shell command shown in a pill with a copy button. */
  commandLine?: string;
  /** Anything below (buttons, links). */
  contents?: ReactNode;
  size?: EmptySize;
  className?: string;
}

function Empty({
  icon,
  title,
  description,
  commandLine,
  contents,
  size = 'base',
  className,
}: EmptyProps) {
  const { copied, runCopy } = useCopyFeedback(1000);
  const handleCopy = useCallback(async () => {
    if (!commandLine) return;
    await runCopy(
      () => navigator.clipboard.writeText(commandLine),
      // Clipboard can be blocked (permissions, insecure page); the button just doesn't tick.
      (error) => console.warn('Clipboard copy failed', error),
    );
  }, [commandLine, runCopy]);

  return (
    <div data-slot="empty" className={cn(emptyVariants({ size }), className)}>
      {icon && <div className="text-muted-foreground [&_svg]:size-8">{icon}</div>}
      <div className="flex min-w-0 flex-col items-center gap-2.5">
        {description ? (
          <Text variant="heading" size="lg" as="h2">
            {title}
          </Text>
        ) : (
          <Text variant="secondary" size="base" as="h2">
            {title}
          </Text>
        )}
        {description && (
          <Text
            variant="secondary"
            size="base"
            DANGEROUS_className="max-w-140 text-center leading-normal text-balance"
          >
            {description}
          </Text>
        )}
      </div>
      {commandLine && (
        <div className="relative inline-flex h-10 max-w-full transform-gpu items-center gap-2 rounded-lg bg-overlay pr-2 pl-3 font-mono shadow-xs ring ring-border">
          <span className="inline-flex min-w-0 items-baseline gap-2">
            <span className="text-muted-foreground select-none">$</span>
            <span className="[scrollbar-width:none] overflow-auto text-base whitespace-nowrap [&::-webkit-scrollbar]:hidden">
              {commandLine}
            </span>
          </span>
          <Button
            className="size-7 px-0 text-muted-foreground"
            size="sm"
            variant="ghost"
            aria-label="Copy command"
            onClick={handleCopy}
          >
            {copied ? (
              <CheckIcon size={16} className="animate-bounce-in text-success" />
            ) : (
              <CopyIcon size={16} />
            )}
          </Button>
        </div>
      )}
      {contents}
    </div>
  );
}

export type { EmptyProps, EmptySize };
export { Empty, emptyVariants };
