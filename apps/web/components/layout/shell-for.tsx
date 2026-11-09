import { callAction } from '@app/core';
import { listInquiries } from '@app/core/inquiries';
import { TimeZoneProvider } from '@app/ui/components/ui-context';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';

import { SITE } from '@/lib/site';
import { getViewerTimeZone } from '@/lib/viewer-prefs';
import {
  ACCOUNT_NAV,
  ADMIN_NAV,
  allItems,
  APPS,
  type AppId,
  CREATE_COMMANDS,
  type NavGroup,
  visibleApps,
  visibleGroups,
  visibleSubmenus,
} from '@/lib/nav';
import type { SignedInViewer } from '@/lib/viewer';

import { AppShell } from './app-shell';
import { parseRailMode, RAIL_MODE_COOKIE } from './rail-mode';

const NAV: Record<AppId, NavGroup[]> = { account: ACCOUNT_NAV, admin: ADMIN_NAV };

/**
 * Builds the shell for one app from the nav declaration and the viewer: hides rows the person may not use,
 * translates labels, reads the rail-mode cookie. Server component; the layouts of /account and /admin are
 * one line each around it.
 */
export async function ShellFor({
  appId,
  viewer,
  children,
}: {
  appId: AppId;
  viewer: SignedInViewer;
  children: ReactNode;
}) {
  const [tn, tp, store, timeZone] = await Promise.all([
    getTranslations('nav'),
    getTranslations('palette'),
    cookies(),
    getViewerTimeZone(),
  ]);
  // How many website inquiries are new: the badge on the Inquiries row. A failure just shows no badge.
  const newInquiries =
    appId === 'admin' && viewer.can('inquiries.manage')
      ? await callAction(listInquiries, { limit: 1 }, viewer.actor)
      : null;
  const counts = { inquiries: newInquiries?.ok ? newInquiries.data.counts.new : 0 };
  const translate = (groups: NavGroup[]): NavGroup[] =>
    groups.map((g) => ({
      ...g,
      label: g.label ? tn(g.key) : '',
      items: g.items.map((i) => ({
        ...i,
        label: tn(i.key),
        count: i.badge ? counts[i.badge] : undefined,
      })),
    }));
  const createCommands = CREATE_COMMANDS.filter((c) => viewer.can(c.permission)).map((c) => ({
    ...c,
    label: tp(`commands.${c.key}`),
  }));

  const app = APPS.find((a) => a.id === appId)!;
  const apps = visibleApps(viewer.can).map((a) => ({ ...a, label: tn(a.key) }));
  const navGroups = translate(visibleGroups(NAV[appId], viewer.can));
  const submenus = visibleSubmenus(viewer.can).map((m) => ({
    ...m,
    label: tn(m.id),
    back: { ...m.back, label: tn('dashboard') },
    groups: translate(m.groups),
  }));
  const items = allItems(navGroups);
  const toDock = (i: (typeof items)[number]) => ({
    href: i.href,
    label: i.label,
    icon: i.icon,
    exact: i.exact,
  });
  const dockItems = items
    .filter((i) => i.dock)
    .slice(0, 4)
    .map(toDock);
  const launcherItems = [
    ...items.map(toDock),
    ...apps
      .filter((a) => a.id !== appId)
      .map((a) => ({ href: a.href, label: a.label, icon: a.icon })),
  ];

  return (
    <NextIntlClientProvider>
      <TimeZoneProvider zone={timeZone}>
        <AppShell
          app={{ ...app, label: tn(app.key) }}
          apps={apps}
          brandName={SITE.name}
          navGroups={navGroups}
          submenus={submenus}
          user={{ id: viewer.contactId, name: viewer.displayName, email: viewer.email }}
          railMode={parseRailMode(store.get(RAIL_MODE_COOKIE)?.value)}
          createCommands={createCommands}
          workspaceTabs={appId === 'admin'}
          dockItems={dockItems}
          launcherItems={launcherItems}
        >
          {children}
        </AppShell>
      </TimeZoneProvider>
    </NextIntlClientProvider>
  );
}
