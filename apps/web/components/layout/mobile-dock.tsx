'use client';

import { cn } from '@app/ui/lib/utils';
import { ListIcon, SquaresFourIcon, type Icon } from '@app/ui/components/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';

import { BottomSheet } from './bottom-sheet';

export type MobileDockItem = { href: string; label: string; icon: Icon; exact?: boolean };

function isActive(path: string, item: MobileDockItem) {
  return item.exact ? path === item.href : path === item.href || path.startsWith(`${item.href}/`);
}

/**
 * The bottom bar on phones: up to four pages, and in the middle a launcher button that opens "All apps"
 * (every page and the other apps). Hidden from `md` up, where the rail is. `allItems` lists the launcher;
 * pass none to hide the middle button.
 */
export function MobileDock({
  items,
  allItems = [],
  title = 'All apps',
}: {
  items: MobileDockItem[];
  allItems?: MobileDockItem[];
  title?: string;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const fab = allItems.length > 0;
  const left = fab ? items.slice(0, 2) : items;
  const right = fab ? items.slice(2, 4) : [];
  return (
    <>
      <nav
        aria-label="Quick navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex h-14 items-center px-1">
          {left.map((item) => (
            <DockLink key={item.href} item={item} active={isActive(path, item)} />
          ))}
          {fab && (
            <div className="flex items-center justify-center px-2">
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={title}
                aria-haspopup="dialog"
                className="-mt-5 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
              >
                <SquaresFourIcon className="size-6" />
              </button>
            </div>
          )}
          {right.map((item) => (
            <DockLink key={item.href} item={item} active={isActive(path, item)} />
          ))}
        </div>
      </nav>
      {fab && (
        <BottomSheet open={open} onOpenChange={setOpen} title={title}>
          <div className="grid grid-cols-4 gap-x-2 gap-y-4">
            {allItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(path, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex flex-col items-center gap-1.5 rounded-xl py-2 text-center transition-colors active:bg-tint"
                >
                  <span
                    className={cn(
                      'flex size-11 items-center justify-center rounded-xl',
                      active ? 'bg-primary/10 text-primary' : 'bg-tint text-foreground',
                    )}
                  >
                    <Icon className="size-5" weight={active ? 'fill' : undefined} />
                  </span>
                  <span className={cn('text-[11px] leading-tight font-medium', active ? 'text-primary' : 'text-muted-foreground')}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </BottomSheet>
      )}
    </>
  );
}

function DockLink({ item, active }: { item: MobileDockItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <div className="flex flex-1 items-center justify-center">
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex h-full min-w-14 flex-col items-center justify-center gap-0.5 transition-colors',
          active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Icon className="size-5" weight={active ? 'fill' : undefined} />
        <span className="text-[10px] font-medium">{item.label}</span>
      </Link>
    </div>
  );
}

/* ── Page options (the ☰ in the header) and the floating action button ────────────────────────── */

type Entry = { id: string; node: ReactNode };
type Slots = {
  options: Entry[];
  fab: ReactNode | null;
  setOption: (id: string, node: ReactNode) => void;
  removeOption: (id: string) => void;
  setFab: (node: ReactNode | null) => void;
};

const SlotsContext = createContext<Slots | null>(null);

/** Mount once in the shell: holds what pages publish for phones (extra options, the main "add" button). */
export function MobilePageActionsProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<Entry[]>([]);
  const [fab, setFab] = useState<ReactNode | null>(null);
  const value = useMemo<Slots>(
    () => ({
      options,
      fab,
      setOption: (id, node) =>
        setOptions((cur) => [...cur.filter((e) => e.id !== id), { id, node }]),
      removeOption: (id) => setOptions((cur) => cur.filter((e) => e.id !== id)),
      setFab,
    }),
    [options, fab],
  );
  return <SlotsContext.Provider value={value}>{children}</SlotsContext.Provider>;
}

/**
 * Put controls in the "Page options" sheet that phones open from the header (sort, view switch …). Render it
 * inside a client component of the page; the options show on phones only. With nothing registered the
 * button does not show.
 *
 *   <MobilePageActions><ExportButton /></MobilePageActions>
 */
export function MobilePageActions({ children }: { children: ReactNode }) {
  const slots = useContext(SlotsContext);
  const id = useId();
  const setOption = slots?.setOption;
  const removeOption = slots?.removeOption;
  useEffect(() => {
    setOption?.(id, children);
    return () => removeOption?.(id);
  }, [id, children, setOption, removeOption]);
  return null;
}

/**
 * The page's one main action (New user, New project) as a floating button on phones. The latest one mounted
 * wins; it disappears when the page unmounts. Give it a single focusable child (a Link or button).
 *
 *   <MobilePrimaryAction><Link href="/admin/users/new" className={fabClass}>…</Link></MobilePrimaryAction>
 */
export function MobilePrimaryAction({ children }: { children: ReactNode }) {
  const slots = useContext(SlotsContext);
  const setFab = slots?.setFab;
  useEffect(() => {
    setFab?.(children);
    return () => setFab?.(null);
  }, [children, setFab]);
  return null;
}

/** Classes for a round "+" floating button (use on the Link/button you give MobilePrimaryAction). */
export const fabClass =
  'flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 [&_svg]:size-6';

/** The header button that opens page options; renders nothing when no page registered any. */
export function MobilePageActionsButton({ label = 'Page options' }: { label?: string }) {
  const slots = useContext(SlotsContext);
  const [open, setOpen] = useState(false);
  if (!slots || slots.options.length === 0) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        aria-haspopup="dialog"
        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-tint hover:text-foreground md:hidden"
      >
        <ListIcon className="size-5" />
      </button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={label}
        // Close after a link or submit button inside the sheet is used.
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a, button[type="submit"], [data-close-sheet]')) setOpen(false);
        }}
      >
        <div className="grid gap-2">
          {slots.options.map((e) => (
            <div key={e.id}>{e.node}</div>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}

/** Renders the floating button; hidden from `md` up. Sits above the dock. */
export function MobilePrimaryActionFab() {
  const slots = useContext(SlotsContext);
  if (!slots?.fab) return null;
  return (
    <div className="pointer-events-none fixed right-5 bottom-20 z-30 md:hidden">
      <div className="pointer-events-auto">{slots.fab}</div>
    </div>
  );
}
