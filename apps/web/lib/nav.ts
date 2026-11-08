import type { Permission } from '@app/core/access';
import {
  BellIcon,
  BookOpenIcon,
  BugIcon,
  GaugeIcon,
  GearIcon,
  HouseIcon,
  type Icon,
  KeyIcon,
  LightningIcon,
  LockIcon,
  PlugIcon,
  PulseIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  UserIcon,
  UsersIcon,
} from '@app/ui/components/icons';

/**
 * THE navigation, in one file. Add a page: add a row here (and the route). The rail, the mobile menu, the
 * launcher, the ⌘K palette, the breadcrumbs and the workspace tabs all read this list.
 *
 * `key` is the translation key under `nav.*` in messages/*.json (the `label` is the English fallback).
 * `permission` hides the row from people who lack it (the page itself still checks, see lib/viewer.ts).
 * `drill` makes the row open a submenu in the rail (see SUBMENUS) instead of being a plain link.
 */
export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: Icon;
  permission?: Permission;
  /** Match only this exact path (the area's home), not everything below it. */
  exact?: boolean;
  /** Other path prefixes that also mark this row active. */
  alsoActiveFor?: string[];
  /** The rail swaps to this submenu while the page is under it. */
  drill?: string;
  /** Show this row in the mobile dock (max 4 across the dock). */
  dock?: boolean;
};

export type NavGroup = { key: string; label: string; items: NavItem[] };

export type SubMenu = {
  id: string;
  label: string;
  /** Paths under which the rail shows this submenu. */
  prefixes: string[];
  back: { href: string; label: string };
  groups: NavGroup[];
};

export type AppId = 'account' | 'admin';

export type AppDef = {
  id: AppId;
  key: string;
  label: string;
  href: string;
  icon: Icon;
  /** Who sees this app in the switcher. Omit for any signed-in person. */
  permission?: Permission;
};

export const APPS: AppDef[] = [
  { id: 'account', key: 'myAccount', label: 'My account', href: '/account', icon: UserIcon },
  {
    id: 'admin',
    key: 'admin',
    label: 'Admin',
    href: '/admin',
    icon: ShieldCheckIcon,
    permission: 'admin.access',
  },
];

export const ACCOUNT_NAV: NavGroup[] = [
  {
    key: 'account',
    label: 'Account',
    items: [
      {
        key: 'account',
        label: 'Overview',
        href: '/account',
        icon: HouseIcon,
        exact: true,
        dock: true,
      },
      { key: 'profile', label: 'Profile', href: '/account/profile', icon: UserIcon, dock: true },
      { key: 'security', label: 'Security', href: '/account/security', icon: LockIcon },
      {
        key: 'notifications',
        label: 'Notifications',
        href: '/account/notifications',
        icon: BellIcon,
        dock: true,
      },
      {
        key: 'preferences',
        label: 'Preferences',
        href: '/account/preferences',
        icon: SlidersHorizontalIcon,
      },
    ],
  },
];

export const ADMIN_NAV: NavGroup[] = [
  {
    key: 'overview',
    label: 'Overview',
    items: [
      {
        key: 'dashboard',
        label: 'Dashboard',
        href: '/admin',
        icon: GaugeIcon,
        exact: true,
        dock: true,
      },
    ],
  },
  {
    key: 'people',
    label: 'People',
    items: [
      {
        key: 'users',
        label: 'Users',
        href: '/admin/users',
        icon: UsersIcon,
        permission: 'users.read',
        dock: true,
      },
      {
        key: 'roles',
        label: 'Roles & permissions',
        href: '/admin/roles',
        icon: ShieldCheckIcon,
        permission: 'roles.manage',
      },
    ],
  },
  {
    // Optional modules: delete the row when you delete the module (docs/architecture.md → Modules).
    key: 'build',
    label: 'Build',
    items: [
      {
        key: 'automations',
        label: 'Automations',
        href: '/admin/automations',
        icon: LightningIcon,
        permission: 'automations.manage',
      },
      {
        key: 'notifications',
        label: 'Notifications',
        href: '/admin/notifications',
        icon: BellIcon,
        permission: 'notifications.manage',
      },
      { key: 'docs', label: 'Docs', href: '/docs', icon: BookOpenIcon },
    ],
  },
  {
    key: 'monitor',
    label: 'Monitor',
    items: [
      {
        key: 'activity',
        label: 'Activity',
        href: '/admin/activity',
        icon: PulseIcon,
        permission: 'activity.read',
        dock: true,
      },
      {
        key: 'errors',
        label: 'Errors',
        href: '/admin/errors',
        icon: BugIcon,
        permission: 'errors.manage',
        dock: true,
      },
      {
        key: 'system',
        label: 'System',
        href: '/admin/system',
        icon: GearIcon,
        permission: 'system.manage',
      },
    ],
  },
  {
    key: 'configure',
    label: 'Configure',
    items: [
      {
        key: 'apiKeys',
        label: 'API keys',
        href: '/admin/api-keys',
        icon: KeyIcon,
        permission: 'api_keys.manage',
      },
      {
        key: 'settings',
        label: 'Settings',
        href: '/admin/settings',
        icon: GearIcon,
        permission: 'settings.manage',
        drill: 'settings',
      },
    ],
  },
];

export const SUBMENUS: SubMenu[] = [
  {
    id: 'settings',
    label: 'Settings',
    prefixes: ['/admin/settings'],
    back: { href: '/admin', label: 'Dashboard' },
    groups: [
      {
        key: 'settings',
        label: '',
        items: [
          {
            key: 'settings',
            label: 'Settings',
            href: '/admin/settings',
            icon: SlidersHorizontalIcon,
            exact: true,
            permission: 'settings.manage',
          },
          {
            key: 'integrations',
            label: 'Integrations',
            href: '/admin/settings/integrations',
            icon: PlugIcon,
            permission: 'settings.manage',
          },
          {
            key: 'apiKeys',
            label: 'API keys',
            href: '/admin/api-keys',
            icon: KeyIcon,
            permission: 'api_keys.manage',
          },
        ],
      },
    ],
  },
];

type Can = (p: Permission) => boolean;

/** Rows (and whole groups) the person may see. */
export function visibleGroups(groups: NavGroup[], can: Can): NavGroup[] {
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.permission || can(i.permission)) }))
    .filter((g) => g.items.length > 0);
}

export function visibleSubmenus(can: Can): SubMenu[] {
  return SUBMENUS.map((m) => ({ ...m, groups: visibleGroups(m.groups, can) }));
}

export function visibleApps(can: Can): AppDef[] {
  return APPS.filter((a) => !a.permission || can(a.permission));
}

/** Is `pathname` on this row? Exact rows match only themselves; others match the path and everything below it. */
export function isItemActive(pathname: string, item: NavItem): boolean {
  const path = pathname.split('?')[0] ?? pathname;
  const hits = (href: string) => path === href || path.startsWith(`${href}/`);
  if (item.exact) return path === item.href;
  return hits(item.href) || (item.alsoActiveFor?.some(hits) ?? false);
}

export function allItems(groups: NavGroup[]): NavItem[] {
  return groups.flatMap((g) => g.items);
}

/** The most specific row for a path (an Errors detail page → the Errors row). */
export function activeItem(pathname: string, groups: NavGroup[]): NavItem | undefined {
  return allItems(groups)
    .filter((i) => isItemActive(pathname, i))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

export function submenuFor(pathname: string, menus: SubMenu[]): SubMenu | undefined {
  return menus.find((m) => m.prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`)));
}
