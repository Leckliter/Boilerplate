'use client';

import { Button } from '@app/ui/components/button';
import { cn } from '@app/ui/lib/utils';
import { useState, useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';
function subscribe(cb: () => void) {
  const m = window.matchMedia(QUERY);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
}

/** Durations, easings and the reduced-motion rule, with a live probe of the visitor's setting. */
export function MotionDemo() {
  const reduced = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
  const [on, setOn] = useState(false);
  const rows: [string, string, string][] = [
    ['duration-100', '100ms (default)', 'Hover and press colours, ring changes'],
    ['duration-150', '150ms', 'Popovers, dialogs, accordions opening'],
    ['duration-300', '300ms', 'Progress fill, sliding panels (rare)'],
  ];
  return (
    <div className="grid gap-5">
      <ul className="grid gap-2 sm:grid-cols-3">
        {rows.map(([cls, time, use]) => (
          <li key={cls} className="grid min-w-0 gap-2 rounded-lg bg-card p-3 ring ring-border">
            <div className="h-6 rounded-md bg-fill">
              <div
                className={cn(
                  'h-6 rounded-md bg-primary transition-[width] ease-out motion-reduce:transition-none',
                  cls,
                  on ? 'w-full' : 'w-6',
                )}
              />
            </div>
            <p className="text-sm font-medium">{time}</p>
            <p className="text-xs text-muted-foreground">
              <code className="font-mono">{cls}</code> · {use}
            </p>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => setOn((v) => !v)}>
          Play
        </Button>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Your device{' '}
          {reduced
            ? 'asks for reduced motion: the bars jump instead of sliding.'
            : 'allows motion. Turn on "Reduce motion" in your system settings to see the bars jump instead.'}
        </p>
      </div>
      <ul className="grid list-disc gap-1 pl-5 text-sm text-muted-foreground">
        <li>
          Motion explains a change (something opened, something moved); it never decorates. Nothing
          loops except loaders and skeletons.
        </li>
        <li>
          Always pair with <code className="font-mono text-xs">motion-reduce:transition-none</code>{' '}
          / <code className="font-mono text-xs">motion-safe:animate-…</code>. Essential feedback
          still appears, without movement.
        </li>
        <li>
          Never animate layout properties of big areas; animate opacity, scale and height of small
          panels.
        </li>
      </ul>
    </div>
  );
}
