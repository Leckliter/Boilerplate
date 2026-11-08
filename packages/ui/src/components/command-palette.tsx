'use client';

import { Autocomplete } from '@base-ui/react/autocomplete';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { CircleNotchIcon, MagnifyingGlassIcon } from './icons';
import * as React from 'react';

import { cn } from '../lib/utils';

export type CommandItem = {
  /** Unique across the whole palette. */
  id: string;
  label: string;
  /** Second line, muted (an email, a status …). */
  description?: string | null;
  icon?: React.ReactNode;
  /** Shown on the right, e.g. "Page" or a keyboard shortcut. */
  hint?: string;
  /** Extra words that should match this item when the palette filters it. */
  keywords?: string[];
};

export type CommandGroup = { label: string; items: CommandItem[] };

/**
 * A command palette (⌘K): a search box over grouped commands and results, all
 * keyboard driven. It does not filter by itself — pass the groups to show for
 * the current `query` (use `filterCommands` for a fixed list, and merge in
 * results fetched from the server). Open it with `<CommandPaletteTrigger>` or
 * `useCommandShortcut`.
 */
function CommandPalette({
  open,
  onOpenChange,
  query,
  onQueryChange,
  groups,
  onSelect,
  loading = false,
  placeholder = 'Search or jump to…',
  emptyText = 'Nothing matches.',
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
  groups: CommandGroup[];
  onSelect: (item: CommandItem) => void;
  loading?: boolean;
  placeholder?: string;
  emptyText?: string;
  /** Replaces the default keyboard hints at the bottom. */
  footer?: React.ReactNode;
}) {
  const shown = groups.filter((g) => g.items.length > 0);
  const hintsId = React.useId();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-overlay opacity-80 transition-all duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Viewport className="fixed inset-0 z-50 flex items-start justify-center px-2 pt-[12dvh] pb-2">
          <DialogPrimitive.Popup
            data-slot="command-palette"
            aria-label="Command palette"
            className={cn(
              'flex max-h-[min(36rem,80dvh)] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-elevated text-foreground shadow-xs ring ring-hairline outline-none',
              'transition-[translate,scale,opacity] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
            )}
          >
            <Autocomplete.Root
              open
              inline
              items={shown}
              filter={null}
              value={query}
              onValueChange={(v) => onQueryChange(v)}
              itemToStringValue={(item: CommandItem) => item.label}
              autoHighlight="always"
              keepHighlight
            >
              <Autocomplete.InputGroup className="flex items-center gap-3 bg-card px-4 py-3 focus-within:ring-2 focus-within:ring-primary">
                {loading ? (
                  <CircleNotchIcon
                    className="size-4 shrink-0 animate-spin text-muted-foreground"
                    aria-hidden
                  />
                ) : (
                  <MagnifyingGlassIcon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                )}
                <Autocomplete.Input
                  aria-label="Search"
                  aria-describedby={hintsId}
                  placeholder={placeholder}
                  className="h-6 w-full min-w-0 bg-transparent text-base text-foreground outline-none placeholder:text-placeholder"
                />
                <kbd className={cn(kbdClass, 'hidden sm:inline-flex')}>Esc</kbd>
              </Autocomplete.InputGroup>
              <DialogPrimitive.Close className="sr-only">Close</DialogPrimitive.Close>

              <div className="relative min-h-0 flex-1 scroll-py-2 overflow-y-auto overscroll-contain rounded-b-lg bg-card p-2 ring-1 ring-hairline">
                <Autocomplete.Empty>
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                    {loading ? 'Searching…' : emptyText}
                  </p>
                </Autocomplete.Empty>
                <Autocomplete.List>
                  {(group: CommandGroup) => (
                    <Autocomplete.Group
                      key={group.label}
                      items={group.items}
                      className="not-last:mb-1.5"
                    >
                      <Autocomplete.GroupLabel className="mb-2 px-2 pt-1 text-xs font-semibold text-muted-foreground select-none">
                        {group.label}
                      </Autocomplete.GroupLabel>
                      <Autocomplete.Collection>
                        {(item: CommandItem) => (
                          <Autocomplete.Item
                            key={item.id}
                            value={item}
                            onClick={() => onSelect(item)}
                            className="group flex min-h-9 w-full cursor-pointer scroll-my-2 items-center gap-3 rounded-lg px-2 py-1.5 text-left text-base transition-colors outline-none select-none data-highlighted:bg-overlay [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground"
                          >
                            {item.icon}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">{item.label}</span>
                              {item.description && (
                                <span className="block truncate text-sm text-muted-foreground">
                                  {item.description}
                                </span>
                              )}
                            </span>
                            {item.hint && (
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {item.hint}
                              </span>
                            )}
                          </Autocomplete.Item>
                        )}
                      </Autocomplete.Collection>
                    </Autocomplete.Group>
                  )}
                </Autocomplete.List>
              </div>

              <div
                id={hintsId}
                className="hidden items-center gap-4 bg-elevated px-4 py-3 text-xs text-muted-foreground sm:flex"
              >
                {footer ?? (
                  <>
                    <span className="flex items-center gap-1">
                      <kbd className={kbdClass}>↑</kbd>
                      <kbd className={kbdClass}>↓</kbd> to move
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className={kbdClass}>Enter</kbd> to open
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className={kbdClass}>Esc</kbd> to close
                    </span>
                  </>
                )}
              </div>
            </Autocomplete.Root>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

const kbdClass =
  'inline-flex h-5 min-w-5 items-center justify-center rounded bg-tint px-1 font-sans text-[0.6875rem] leading-none text-muted-foreground ring ring-border';

/**
 * Looks like a search box; opens the palette. Shows the ⌘K / Ctrl K shortcut.
 */
function CommandPaletteTrigger({
  className,
  label = 'Search…',
  ...props
}: Omit<React.ComponentProps<'button'>, 'children'> & { label?: string }) {
  const [mod, setMod] = React.useState('Ctrl');
  React.useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setMod('⌘');
  }, []);
  return (
    <button
      type="button"
      data-slot="command-palette-trigger"
      className={cn(
        'flex h-8 w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg bg-card px-2.5 text-sm text-muted-foreground shadow-xs ring ring-border transition-colors outline-none hover:bg-tint hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary',
        className,
      )}
      {...props}
    >
      <MagnifyingGlassIcon className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 truncate text-left">{label}</span>
      <kbd className={cn(kbdClass, 'hidden md:inline-flex')}>{mod === '⌘' ? '⌘K' : 'Ctrl K'}</kbd>
    </button>
  );
}

/** Calls `onOpen` on ⌘K / Ctrl+K (and on "/" when not typing in a field). */
function useCommandShortcut(onOpen: () => void) {
  const ref = React.useRef(onOpen);
  React.useEffect(() => {
    ref.current = onOpen;
  });
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey) && !e.altKey) {
        e.preventDefault();
        ref.current();
      } else if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        ref.current();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Keep the items whose label or keywords contain every word of the query. */
function filterCommands(items: CommandItem[], query: string): CommandItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  return items.filter((item) => {
    const text = [item.label, item.description ?? '', ...(item.keywords ?? [])]
      .join(' ')
      .toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

export { CommandPalette, CommandPaletteTrigger, filterCommands, useCommandShortcut };
