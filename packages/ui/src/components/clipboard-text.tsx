'use client';

/**
 * ClipboardText — a read-only value with a copy button (and, when `masked`, a reveal button).
 * Cloudflare Kumo (MIT) `clipboard-text`: sized like an Input, monospace text, buttons on the
 * right behind a hairline. The copy icon slides up into a check for 1.5 s after copying.
 *
 *   <ClipboardText text="sk_live_51Mx…" masked />
 */
import { forwardRef, useCallback, useState, type ReactElement } from 'react';

import { cn } from '../lib/utils';
import { useCopyFeedback } from '../lib/use-copy-feedback';
import { CheckIcon, CopyIcon, EyeIcon, EyeSlashIcon } from './icons';
import { inputVariants } from './input';
import { Tooltip } from './tooltip';

type ClipboardTextSize = 'sm' | 'base' | 'lg';

const SIZES: Record<
  ClipboardTextSize,
  { text: string; input: 'sm' | 'base' | 'lg'; icon: string }
> = {
  sm: { text: 'text-xs', input: 'sm', icon: 'size-3.5' },
  base: { text: 'text-sm', input: 'base', icon: 'size-4' },
  lg: { text: 'text-sm', input: 'lg', icon: 'size-4' },
};

const COPIED_FEEDBACK_MS = 1500;

/** Writes to the clipboard, falling back to a hidden textarea where the async API is blocked. */
async function writeClipboard(value: string) {
  if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') {
    await navigator.clipboard.writeText(value);
    return;
  }
  if (typeof document === 'undefined') throw new Error('Clipboard is unavailable');
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  const selection = document.getSelection();
  const previousRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
  textarea.select();
  try {
    if (!document.execCommand('copy')) throw new Error('Copy command was not accepted');
  } finally {
    document.body.removeChild(textarea);
    if (previousRange) {
      selection?.removeAllRanges();
      selection?.addRange(previousRange);
    }
  }
}

const sideButton =
  'relative isolate inline-flex h-full shrink-0 cursor-pointer items-center justify-center overflow-hidden border-l border-border bg-transparent px-3 text-foreground outline-none transition-colors hover:bg-fill-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset';

type ClipboardTextProps = {
  /** The value shown. */
  text: string;
  /** What gets copied, when it differs from `text`. */
  textToCopy?: string;
  /** Hides the value behind dots until the eye button is pressed. */
  masked?: boolean;
  size?: ClipboardTextSize;
  className?: string;
  onCopy?: () => void;
  /** Tooltip over the copy button (switches to `copiedText` after a copy). */
  tooltip?: { text?: string; copiedText?: string; side?: 'top' | 'bottom' | 'left' | 'right' };
  /** Screen-reader words. */
  labels?: { copyAction?: string; revealAction?: string; hideAction?: string };
};

const ClipboardText = forwardRef<HTMLDivElement, ClipboardTextProps>(
  (
    {
      text,
      textToCopy,
      masked = false,
      size = 'lg',
      className,
      onCopy,
      tooltip,
      labels: {
        copyAction = 'Copy to clipboard',
        revealAction = 'Reveal value',
        hideAction = 'Hide value',
      } = {},
    },
    ref,
  ) => {
    const [revealed, setRevealed] = useState(false);
    const { copied, runCopy } = useCopyFeedback(COPIED_FEEDBACK_MS);
    const s = SIZES[size] ?? SIZES.lg;
    const { text: tooltipText = 'Copy', copiedText = 'Copied', side = 'top' } = tooltip ?? {};

    const copy = useCallback(async () => {
      const done = await runCopy(
        () => writeClipboard(textToCopy ?? text),
        // Clipboard blocked (e.g. not HTTPS): the value is still on screen to select by hand.
        (error) => console.warn('Clipboard copy failed', error),
      );
      if (done) onCopy?.();
    }, [runCopy, textToCopy, text, onCopy]);

    const slide = 'flex items-center justify-center transition-all duration-200';
    const copyButton: ReactElement = (
      <button
        type="button"
        className={cn(sideButton, 'rounded-r-[inherit]')}
        onClick={copy}
        aria-label={copyAction}
      >
        <span
          className={cn(
            slide,
            'absolute inset-0',
            copied ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0',
          )}
        >
          <CheckIcon className={s.icon} />
        </span>
        <span className={cn(slide, copied ? '-translate-y-full opacity-0' : 'translate-y-0')}>
          <CopyIcon className={s.icon} />
        </span>
      </button>
    );

    return (
      <div
        ref={ref}
        data-slot="clipboard-text"
        className={cn(
          inputVariants({ size: s.input }),
          'flex w-full min-w-0 items-center gap-0 overflow-hidden bg-card px-0 font-mono',
          s.text,
          className,
        )}
      >
        <span className="min-w-0 grow truncate ps-4 pe-2">
          {masked && !revealed ? '••••••••' : text}
        </span>
        {masked && (
          <button
            type="button"
            className={sideButton}
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? hideAction : revealAction}
            aria-pressed={revealed}
          >
            {revealed ? <EyeSlashIcon className={s.icon} /> : <EyeIcon className={s.icon} />}
          </button>
        )}
        {tooltip ? (
          <Tooltip content={copied ? copiedText : tooltipText} side={side}>
            {copyButton}
          </Tooltip>
        ) : (
          copyButton
        )}
        <span className="sr-only" aria-live="polite">
          {copied ? copiedText : ''}
        </span>
      </div>
    );
  },
);
ClipboardText.displayName = 'ClipboardText';

export { ClipboardText };
export type { ClipboardTextProps, ClipboardTextSize };
