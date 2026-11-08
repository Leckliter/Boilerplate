'use client';

import { useCopyFeedback } from '../lib/use-copy-feedback';
import { Button } from './button';
import { CheckIcon, CopyIcon } from './icons';

/**
 * Copies `value` to the clipboard and confirms with a tick. Used for error
 * references and anything else people paste elsewhere (e.g. into an AI chat).
 */
function CopyButton({
  value,
  children = 'Copy',
  variant = 'secondary',
  size = 'sm',
  className,
}: {
  value: string;
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}) {
  // Kumo's copy feedback: the tick stays 2 s after the latest successful copy.
  const { copied, runCopy } = useCopyFeedback(2_000);
  return (
    <Button
      type="button"
      className={className}
      variant={variant}
      size={size}
      aria-live="polite"
      onClick={() =>
        runCopy(
          () => navigator.clipboard.writeText(value),
          // Clipboard blocked (e.g. not HTTPS): the value is still on screen to select by hand.
          () => {},
        )
      }
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? 'Copied' : children}
    </Button>
  );
}

/**
 * The block shown when something breaks: what happened, the error reference
 * to quote (or give to an AI agent), and what to do next.
 */
function ErrorReference({ reference }: { reference: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm">
      <span className="text-muted-foreground">Error reference</span>
      <code className="font-mono font-medium select-all">{reference}</code>
      <CopyButton value={reference} size="xs" variant="ghost" />
    </div>
  );
}

export { CopyButton, ErrorReference };
