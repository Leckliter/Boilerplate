/**
 * How the desktop rail sits, picked from the menu at its foot: open all the time, icons only, or icons that
 * open while the pointer is over them. Kept in a cookie rather than localStorage so the server renders the
 * rail the way it was left, with no slide on load.
 */
export type RailMode = 'expanded' | 'collapsed' | 'hover';

export const RAIL_MODES: { value: RailMode; label: string; key: string }[] = [
  { value: 'expanded', label: 'Expanded', key: 'expanded' },
  { value: 'collapsed', label: 'Collapsed', key: 'collapsed' },
  { value: 'hover', label: 'Expand on hover', key: 'hover' },
];

export const RAIL_MODE_COOKIE = 'rail-mode';

export function parseRailMode(value: string | undefined | null): RailMode {
  return RAIL_MODES.find((m) => m.value === value)?.value ?? 'expanded';
}

/** Fades text out as the rail closes over it (it stays laid out, so icons hold still). */
export const HIDE_COLLAPSED =
  'transition-opacity duration-(--sidebar-animation-duration) group-data-[state=collapsed]/sidebar:pointer-events-none group-data-[state=collapsed]/sidebar:opacity-0';
