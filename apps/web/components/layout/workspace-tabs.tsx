'use client';

import { Tabs } from '@app/ui/components/tabs';
import { PlusIcon, XIcon } from '@app/ui/components/icons';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { activeItem, type NavGroup } from '@/lib/nav';

/**
 * Workspace tabs for Admin: a strip of places, each one a page left where it was (its URL with filters, and
 * how far it was scrolled). Ctrl/⌘-click or middle-click any admin link to open it in a new tab here instead
 * of a new browser tab; × (or middle-click on a tab) closes one. Tabs are kept per person in this browser
 * (localStorage), so a reload puts them back. Desktop only: a phone shows where you are and the menu does the rest.
 *
 * Every tab is a page navigation. What a page wants to survive switching away (a filter, the sub-tab in
 * view) it keeps with `useRemembered`, which stores it with the tab and restores it when the tab comes round again.
 */

type Tab = { id: number; href: string; title?: string; scroll?: number };
type State = { tabs: Tab[]; activeId: number };
type Memory = Record<number, Record<string, unknown>>;

const MAX_TABS = 12;
const MEMORY_PER_TAB = 60;
const ADMIN_PATH = /^\/admin(\/|$)/;

const stateKey = (user: string) => `workspace-tabs:${user}`;
const memoryKey = (user: string) => `workspace-tab-memory:${user}`;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // Expected: storage blocked or the saved value is corrupt — start fresh.
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Expected: storage blocked or full — tabs just won't survive a reload.
  }
}

const pathOf = (href: string) => href.split('?')[0] ?? href;
const here = () => window.location.pathname + window.location.search;
const main = () => document.querySelector<HTMLElement>('[data-shell-main]');

type Ctx = {
  tabs: Tab[];
  activeId: number;
  activate: (id: number) => void;
  close: (id: number) => void;
  open: (href: string) => void;
  remember: (key: string, value: unknown) => void;
  recall: (key: string) => unknown;
  titleFor: (tab: Tab) => string;
};
const TabsContext = createContext<Ctx | null>(null);

export function WorkspaceTabsProvider({
  userId,
  groups,
  children,
}: {
  userId: string;
  groups: NavGroup[];
  children: ReactNode;
}) {
  return (
    <Suspense>
      <Provider userId={userId} groups={groups}>
        {children}
      </Provider>
    </Suspense>
  );
}

function Provider({
  userId,
  groups,
  children,
}: {
  userId: string;
  groups: NavGroup[];
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const url = search ? `${pathname}?${search}` : pathname;
  // Start with one tab at the current page (matches the server render); saved tabs load after hydration.
  const [state, setState] = useState<State>({ tabs: [{ id: 1, href: url }], activeId: 1 });
  const memory = useRef<Memory>({});
  const restored = useRef(false);
  const nextId = useRef(2);
  const skipSave = useRef(true);

  // Restore saved tabs once, with the page in the address bar winning.
  useEffect(() => {
    const saved = load<State | null>(stateKey(userId), null);
    memory.current = load<Memory>(memoryKey(userId), {});
    const valid =
      saved?.tabs.filter((t) => typeof t.id === 'number' && ADMIN_PATH.test(pathOf(t.href))) ?? [];
    if (valid.length > 0) {
      const holder = valid.find((t) => t.href === url);
      const activeId =
        holder?.id ??
        (valid.some((t) => t.id === saved?.activeId) ? saved!.activeId : valid[0]!.id);
      const tabs = holder ? valid : valid.map((t) => (t.id === activeId ? { ...t, href: url } : t));
      nextId.current = Math.max(...tabs.map((t) => t.id)) + 1;
      // Restoring saved state from an external store after hydration is what this effect is for.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ tabs, activeId });
    }
    restored.current = true;
    // Only on mount: later URL changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Navigating inside a tab moves that tab to the new page.
  useEffect(() => {
    if (!restored.current) return;
    setState((s) =>
      s.tabs.find((t) => t.id === s.activeId)?.href === url
        ? s
        : {
            ...s,
            tabs: s.tabs.map((t) =>
              t.id === s.activeId ? { ...t, href: url, title: undefined } : t,
            ),
          },
    );
  }, [url]);

  // Learn each tab's title from the page once it has loaded.
  useEffect(() => {
    const t = setTimeout(() => {
      const raw = document.title.split(' · ')[0]?.trim();
      if (!raw) return;
      setState((s) => ({
        ...s,
        tabs: s.tabs.map((tab) =>
          tab.id === s.activeId && tab.href === url && tab.title !== raw
            ? { ...tab, title: raw }
            : tab,
        ),
      }));
    }, 250);
    return () => clearTimeout(t);
  }, [url]);

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    save(stateKey(userId), state);
  }, [state, userId]);

  const rememberScroll = useCallback(() => {
    const el = main();
    setState((s) => ({
      ...s,
      tabs: s.tabs.map((t) => (t.id === s.activeId ? { ...t, scroll: el?.scrollTop ?? 0 } : t)),
    }));
  }, []);

  const restoreScroll = useCallback((top: number) => {
    let frames = 0;
    const tick = () => {
      const el = main();
      if (!el) return;
      el.scrollTop = top;
      if (Math.abs(el.scrollTop - top) > 1 && frames++ < 60) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  const go = useCallback(
    (tab: Tab) => {
      router.push(tab.href);
      if (tab.scroll) restoreScroll(tab.scroll);
    },
    [router, restoreScroll],
  );

  const activate = useCallback(
    (id: number) => {
      if (id === state.activeId) return;
      const tab = state.tabs.find((t) => t.id === id);
      if (!tab) return;
      rememberScroll();
      setState((s) => ({ ...s, activeId: id }));
      go(tab);
    },
    [state, rememberScroll, go],
  );

  const open = useCallback(
    (href: string) => {
      rememberScroll();
      const id = nextId.current++;
      setState((s) => {
        const tabs = [...s.tabs, { id, href }].slice(-MAX_TABS);
        return { tabs, activeId: id };
      });
      router.push(href);
    },
    [router, rememberScroll],
  );

  const close = useCallback(
    (id: number) => {
      if (state.tabs.length === 1) return;
      const index = state.tabs.findIndex((t) => t.id === id);
      const tabs = state.tabs.filter((t) => t.id !== id);
      delete memory.current[id];
      save(memoryKey(userId), memory.current);
      if (id !== state.activeId) {
        setState({ ...state, tabs });
        return;
      }
      const next = tabs[Math.min(index, tabs.length - 1)]!;
      setState({ tabs, activeId: next.id });
      go(next);
    },
    [state, userId, go],
  );

  const remember = useCallback(
    (key: string, value: unknown) => {
      const slot = (memory.current[state.activeId] ??= {});
      slot[`${pathOf(here())}::${key}`] = value;
      const keys = Object.keys(slot);
      if (keys.length > MEMORY_PER_TAB) delete slot[keys[0]!];
      save(memoryKey(userId), memory.current);
    },
    [state.activeId, userId],
  );

  const recall = useCallback(
    (key: string) => memory.current[state.activeId]?.[`${pathOf(here())}::${key}`],
    [state.activeId],
  );

  // Ctrl/⌘-click or middle-click on an admin link opens it in a new workspace tab.
  useEffect(() => {
    function link(e: MouseEvent): string | null {
      const a = (e.target as HTMLElement | null)?.closest('a[href]');
      if (!a || a.getAttribute('target') === '_blank') return null;
      const u = new URL((a as HTMLAnchorElement).href, window.location.href);
      return u.origin === window.location.origin && ADMIN_PATH.test(u.pathname)
        ? u.pathname + u.search
        : null;
    }
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || !(e.ctrlKey || e.metaKey) || e.shiftKey) return;
      const href = link(e);
      if (!href) return;
      e.preventDefault();
      open(href);
    };
    const onAux = (e: MouseEvent) => {
      if (e.button !== 1) return;
      const href = link(e);
      if (!href) return;
      e.preventDefault();
      open(href);
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('auxclick', onAux, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('auxclick', onAux, true);
    };
  }, [open]);

  const titleFor = useCallback(
    (tab: Tab) => tab.title ?? activeItem(pathOf(tab.href), groups)?.label ?? 'Admin',
    [groups],
  );

  const value = useMemo<Ctx>(
    () => ({
      tabs: state.tabs,
      activeId: state.activeId,
      activate,
      close,
      open,
      remember,
      recall,
      titleFor,
    }),
    [state, activate, close, open, remember, recall, titleFor],
  );
  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>;
}

export function useWorkspaceTabs() {
  return useContext(TabsContext);
}

/**
 * `useState` that is remembered per workspace tab and page: a filter, the sub-tab in view. Switch tabs and
 * back and it is as you left it. Outside the workspace tabs (account, public site) it is plain `useState`.
 */
export function useRemembered<T>(key: string, initial: T): [T, (value: T) => void] {
  const tabs = useContext(TabsContext);
  const [value, setValue] = useState<T>(initial);
  const recall = tabs?.recall;
  const remember = tabs?.remember;
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const saved = recall?.(key);
    // Reading the remembered value once after hydration is what this effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved !== undefined) setValue(saved as T);
  }, [key, recall]);
  const set = useCallback(
    (next: T) => {
      setValue(next);
      remember?.(key, next);
    },
    [key, remember],
  );
  return [value, set];
}

/**
 * The strip. Rendered in the shell under the header, desktop only.
 * Only real tabs sit inside the tablist: "New tab" and "Close tab" are `trailing` controls beside it
 * (a button inside role=tablist is an accessibility error). Middle-click or Delete on a tab closes it.
 */
export function WorkspaceTabsStrip() {
  const t = useTranslations('shell');
  const ctx = useWorkspaceTabs();
  if (!ctx) return null;
  const { tabs, activeId, activate, close, open } = ctx;
  const active = tabs.find((tab) => tab.id === activeId);
  return (
    <div aria-label={t('openPages')} role="group" className="min-w-0 px-3 pt-1.5">
      <Tabs
        variant="underline"
        size="sm"
        value={String(activeId)}
        onValueChange={(id) => activate(Number(id))}
        tabs={tabs.map((tab) => ({
          value: String(tab.id),
          label: <span className="max-w-48 truncate">{ctx.titleFor(tab)}</span>,
          render: (props) => (
            <button
              {...props}
              type="button"
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  close(tab.id);
                }
              }}
              onKeyDown={(e) => {
                props.onKeyDown?.(e);
                if (e.key === 'Delete' && tabs.length > 1) close(tab.id);
              }}
            />
          ),
        }))}
        trailing={
          <div className="flex items-center gap-1">
            {tabs.length > 1 && active && (
              <button
                type="button"
                aria-label={t('closeTab', { title: ctx.titleFor(active) })}
                onClick={() => close(active.id)}
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-tint hover:text-foreground focus-visible:ring-[1.5px] focus-visible:ring-ring"
              >
                <XIcon className="size-4" />
              </button>
            )}
            <button
              type="button"
              aria-label={t('newTab')}
              onClick={() => open(`/admin`)}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-tint hover:text-foreground focus-visible:ring-[1.5px] focus-visible:ring-ring"
            >
              <PlusIcon className="size-4" />
            </button>
          </div>
        }
      />
    </div>
  );
}
