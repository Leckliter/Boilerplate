'use client';

import { Logo } from '@app/ui/components/logo';
import { Sidebar, useSidebar } from '@app/ui/components/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@app/ui/components/dropdown-menu';
import { ListIcon, SidebarSimpleIcon, XIcon } from '@app/ui/components/icons';
import { cn } from '@app/ui/lib/utils';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useState, useSyncExternalStore } from 'react';

import {
  activeItem,
  type AppDef,
  type CreateCommand,
  type NavGroup,
  submenuFor,
  type SubMenu,
} from '@/lib/nav';

import { AppNav, AppSubNav } from './app-nav';
import { CommandMenuProvider, CommandMenuTrigger, useCommandMenu } from './command-menu';
import { HeaderCrumbs } from './header-crumbs';
import {
  MobileDock,
  type MobileDockItem,
  MobilePageActionsButton,
  MobilePageActionsProvider,
  MobilePrimaryActionFab,
} from './mobile-dock';
import { NotificationsBell } from './notifications-bell';
import { HIDE_COLLAPSED, RAIL_MODE_COOKIE, RAIL_MODES, type RailMode } from './rail-mode';
import { ThemeSwitch } from './theme-switch';
import { UserMenu } from './user-menu';
import { WorkspaceTabsProvider, WorkspaceTabsStrip } from './workspace-tabs';

/**
 * Kumo re-centres the icons as the rail collapses, padding in by 3px a side and sliding each row back to
 * match. Holding both at their collapsed values keeps every icon where it is, so opening the rail only
 * uncovers the labels.
 */
const STILL_ICONS =
  '[&_[data-sidebar=viewport]]:px-[11px]! [&_[data-sidebar=menu-button]>div]:-translate-x-[3px]!';

/** The sidebar's breakpoint: below it the rail is the slide-in drawer. */
const PHONE_QUERY = '(max-width: 767px)';

function subscribePhone(onChange: () => void) {
  const mql = window.matchMedia(PHONE_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function useIsPhone() {
  return useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

export type ShellUser = { id: string; name: string; email: string };

export type AppShellProps = {
  /** The app this shell is for. */
  app: AppDef;
  /** Apps this person may open (the switcher, ⌘K). */
  apps: AppDef[];
  brandName: string;
  /** Permission-filtered, translated nav (lib/nav.ts). */
  navGroups: NavGroup[];
  submenus?: SubMenu[];
  user: ShellUser;
  /** The `rail-mode` cookie, read by the layout so the first paint is right. */
  railMode?: RailMode;
  /** "Create …" commands for ⌘K (permission-filtered, translated). */
  createCommands?: CreateCommand[];
  /** Workspace tabs across the top of the content (admin). */
  workspaceTabs?: boolean;
  /** Rows for the phone's bottom dock (max 4) and the launcher. */
  dockItems?: MobileDockItem[];
  launcherItems?: MobileDockItem[];
  /** Extra header controls before the bell (a notifications module replaces the bell itself). */
  headerActions?: ReactNode;
  children: ReactNode;
};

/**
 * THE shell, shared by /account and /admin. A pinned rail on desktop (expanded, collapsed to icons, or
 * expanding on hover; remembered in a cookie), the slide-in drawer on phones, and the main↔submenu drill
 * animated with `Sidebar.SlidingViews`. The header carries the trail, ⌘K, theme, bell and user menu; on phones
 * a bottom dock, "All apps" launcher, page-options sheet and floating action button take over.
 *
 * It owns navigation chrome only: what each page shows is the page's business, and what each person
 * may see is decided in the layout (permission-filtered `navGroups`) and again in every action.
 */
export function AppShell({
  app,
  apps,
  brandName,
  navGroups,
  submenus = [],
  user,
  railMode: initialRailMode = 'expanded',
  createCommands = [],
  workspaceTabs = false,
  dockItems = [],
  launcherItems = [],
  headerActions,
  children,
}: AppShellProps) {
  const t = useTranslations('shell');
  const [railMode, setRailMode] = useState<RailMode>(initialRailMode);
  const isPhone = useIsPhone();
  const changeRailMode = (mode: RailMode) => {
    setRailMode(mode);
    document.cookie = `${RAIL_MODE_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
  };
  const hasDock = dockItems.length > 0;

  const shell = (
    <CommandMenuProvider groups={navGroups} apps={apps} createCommands={createCommands}>
      <MobilePageActionsProvider>
        {/* `contained` scopes the drawer/backdrop to this wrapper: the shell owns its own h-svh viewport and
            scrolls inside <main>. Phones leave `open` to the sidebar (a controlled `open` would pin the drawer). */}
        <Sidebar.Provider
          contained
          collapsible="icon"
          open={isPhone ? undefined : railMode === 'expanded'}
          peekable={railMode === 'hover'}
          className="h-svh overflow-hidden"
        >
          <Rail
            app={app}
            brandName={brandName}
            navGroups={navGroups}
            submenus={submenus}
            railMode={railMode}
            onRailModeChange={changeRailMode}
          />
          <ContentColumn>
            <header className="z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
              <MobileNavToggle label={t('openMenu')} />
              <MobileLocation app={app} navGroups={navGroups} />
              <HeaderCrumbs app={app} groups={navGroups} />
              <div className="ml-auto flex shrink-0 items-center gap-1">
                <CommandMenuTrigger className="hidden w-52 md:flex lg:w-64" />
                <MobilePageActionsButton label={t('pageOptions')} />
                {headerActions}
                <ThemeSwitch compact />
                <NotificationsBell />
                <UserMenu name={user.name} email={user.email} apps={apps} currentApp={app.id} />
              </div>
            </header>
            {workspaceTabs && (
              <div className="hidden shrink-0 border-b border-border bg-recessed md:block">
                <WorkspaceTabsStrip />
              </div>
            )}
            <div className="flex min-h-0 flex-1 overflow-hidden">
              {/* The skip link in the root layout jumps here. Pages own their width; <main> only scrolls. */}
              <main
                id="main-content"
                tabIndex={-1}
                data-shell-main
                className={cn(
                  'flex min-w-0 flex-1 [scrollbar-gutter:stable] flex-col overflow-y-auto bg-background outline-none',
                  hasDock && 'pb-20 md:pb-0',
                )}
              >
                <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
                  {children}
                </div>
              </main>
            </div>
          </ContentColumn>
          {hasDock && (
            <MobileDock items={dockItems} allItems={launcherItems} title={t('allApps')} />
          )}
          <MobilePrimaryActionFab />
        </Sidebar.Provider>
      </MobilePageActionsProvider>
    </CommandMenuProvider>
  );
  return workspaceTabs ? (
    <WorkspaceTabsProvider userId={user.id} groups={navGroups}>
      {shell}
    </WorkspaceTabsProvider>
  ) : (
    shell
  );
}

/**
 * Everything beside the rail. While the mobile drawer is open this column goes `inert`, so keyboard and
 * screen-reader users can't Tab through the backdrop into the page behind it.
 */
function ContentColumn({ children }: { children: ReactNode }) {
  const { isMobile, openMobile } = useSidebar();
  return (
    <div
      inert={isMobile && openMobile ? true : undefined}
      className="flex min-w-0 flex-1 flex-col overflow-hidden"
    >
      {children}
    </div>
  );
}

function Rail({
  app,
  brandName,
  navGroups,
  submenus,
  railMode,
  onRailModeChange,
}: {
  app: AppDef;
  brandName: string;
  navGroups: NavGroup[];
  submenus: SubMenu[];
  railMode: RailMode;
  onRailModeChange: (mode: RailMode) => void;
}) {
  const t = useTranslations('shell');
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const closeDrawer = () => setOpenMobile(false);

  const active = submenuFor(pathname, submenus);
  // Keep the last submenu rendered while the rail slides back to the main nav, so the exiting pane isn't empty.
  const [last, setLast] = useState(active);
  if (active && active !== last) setLast(active);
  const submenu = active ?? last;

  return (
    <Sidebar
      // Before hydration the provider assumes desktop and would paint the pinned aside on phones: hide it
      // below md with CSS; the mobile sheet takes over once hydrated.
      className={cn('max-md:[&:not([data-mobile])]:hidden', STILL_ICONS)}
      {...(isMobile ? { role: 'dialog', 'aria-modal': true } : {})}
    >
      <Sidebar.Header className="h-14 gap-2">
        <Link
          href={app.href}
          className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-tint"
          onClick={closeDrawer}
        >
          <Logo name={brandName} compact />
          <span className={cn('truncate text-sm font-semibold', HIDE_COLLAPSED)}>{brandName}</span>
        </Link>
        <button
          type="button"
          onClick={closeDrawer}
          aria-label={t('closeMenu')}
          className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-tint hover:text-foreground md:hidden"
        >
          <XIcon className="size-5" />
        </button>
      </Sidebar.Header>

      <div className="shrink-0 px-3 py-2 md:hidden">
        <RailSearch onNavigate={closeDrawer} />
      </div>

      <Sidebar.SlidingViews activeKey={active ? 'submenu' : 'main'}>
        <Sidebar.SlidingView value="main">
          <Sidebar.Content>
            <AppNav groups={navGroups} label={app.label} onNavigate={closeDrawer} />
          </Sidebar.Content>
        </Sidebar.SlidingView>
        <Sidebar.SlidingView value="submenu">
          <Sidebar.Content>
            {submenu ? (
              <AppSubNav
                back={submenu.back}
                label={submenu.label}
                header={submenu.label}
                groups={submenu.groups}
                onNavigate={closeDrawer}
              />
            ) : null}
          </Sidebar.Content>
        </Sidebar.SlidingView>
      </Sidebar.SlidingViews>

      {/* Not Sidebar.Footer, which sits outside the area that peeks the rail open on hover. Desktop only. */}
      {isMobile ? null : (
        <div className="flex shrink-0 items-center border-t border-border px-3 py-2">
          <RailModeMenu mode={railMode} onChange={onRailModeChange} />
        </div>
      )}
    </Sidebar>
  );
}

function RailSearch({ onNavigate }: { onNavigate: () => void }) {
  const menu = useCommandMenu();
  return (
    <div
      onClickCapture={() => {
        onNavigate();
        menu?.open();
      }}
    >
      <CommandMenuTrigger />
    </div>
  );
}

/** The button at the rail's foot that picks how the rail sits. */
function RailModeMenu({ mode, onChange }: { mode: RailMode; onChange: (mode: RailMode) => void }) {
  const t = useTranslations('shell');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('sidebar')}
        title={t('sidebar')}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-tint hover:text-foreground focus-visible:ring-[1.5px] focus-visible:ring-ring"
      >
        <SidebarSimpleIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start">
        <DropdownMenuRadioGroup value={mode} onValueChange={(v) => onChange(v as RailMode)}>
          {RAIL_MODES.map((m) => (
            <DropdownMenuRadioItem key={m.value} value={m.value}>
              {t(m.key)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Phones: ☰ opens the nav drawer. */
function MobileNavToggle({ label }: { label: string }) {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={label}
      aria-haspopup="dialog"
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-tint hover:text-foreground md:hidden"
    >
      <ListIcon className="size-5" />
    </button>
  );
}

/** Phones: "where am I" beside the ☰ (the breadcrumbs are for wider screens). */
function MobileLocation({ app, navGroups }: { app: AppDef; navGroups: NavGroup[] }) {
  const pathname = usePathname();
  const text = activeItem(pathname, navGroups)?.label ?? app.label;
  return <span className="min-w-0 truncate text-sm font-semibold sm:hidden">{text}</span>;
}
