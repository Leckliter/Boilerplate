'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import { cn } from '../../lib/utils';

/** A grey pulsing bar, the placeholder while the nav loads. */
export function SkeletonLine({ className }: { className?: string }) {
  return <div aria-hidden className={cn('h-3 animate-pulse rounded bg-fill', className)} />;
}

export function unwrapLazyElement<T>(value: T): T {
  return value;
}

export type SidebarSide = 'left' | 'right';
export type SidebarVariant = 'sidebar' | 'floating' | 'inset';

// ============================================================================
// Constants
// ============================================================================

export const SIDEBAR_WIDTH = '16.25rem';
export const SIDEBAR_WIDTH_ICON = '57px';
export const SIDEBAR_EASING = 'cubic-bezier(0.77, 0, 0.175, 1)';
export const SIDEBAR_ANIMATION_DURATION_MS = 250;
const TRANSITION_FALLBACK_GRACE_MS = 50;
const MOBILE_BREAKPOINT = 768;
export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useOpenChangeComplete(
  open: boolean,
  duration: number,
  onComplete?: (open: boolean) => void,
  active = true,
) {
  const enabled = active && onComplete !== undefined;
  const callbackRef = useRef(onComplete);
  const durationRef = useRef(duration);
  const previousOpenRef = useRef(open);
  const previousActiveRef = useRef(active);
  const pendingOpenRef = useRef<boolean | undefined>(undefined);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  callbackRef.current = onComplete;
  durationRef.current = duration;

  const complete = useCallback(() => {
    const pendingOpen = pendingOpenRef.current;
    if (pendingOpen === undefined) return;

    pendingOpenRef.current = undefined;
    clearTimeout(timeoutRef.current);
    callbackRef.current?.(pendingOpen);
  }, []);

  useEffect(() => {
    const openChanged = previousOpenRef.current !== open;
    const wasActive = previousActiveRef.current;
    previousOpenRef.current = open;
    previousActiveRef.current = active;
    if (!enabled) {
      pendingOpenRef.current = undefined;
      clearTimeout(timeoutRef.current);
      return;
    }
    if (!wasActive || !openChanged) return;

    pendingOpenRef.current = open;
    if (
      durationRef.current === 0 ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      complete();
      return;
    }
    timeoutRef.current = setTimeout(complete, durationRef.current + TRANSITION_FALLBACK_GRACE_MS);
    return () => clearTimeout(timeoutRef.current);
  }, [active, complete, enabled, open]);

  return complete;
}

// ============================================================================
// Mobile detection hook
// ============================================================================

export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT) {
  const query = `(max-width: ${breakpoint - 1}px)`;

  const subscribe = useCallback(
    (callback: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', callback);
      return () => mql.removeEventListener('change', callback);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ============================================================================
// Context
// ============================================================================
