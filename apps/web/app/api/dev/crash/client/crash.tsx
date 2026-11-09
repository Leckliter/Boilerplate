'use client';

/** Throws when it renders in the browser. Only ever mounted by the dev-only page next to it. */
export function Crash(): never {
  throw new Error('E2E client page crash');
}
