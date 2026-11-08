'use client';

import { cn } from '@app/ui/lib/utils';
import { Sidebar } from '@app/ui/components/sidebar';
import { CaretLeftIcon } from '@app/ui/components/icons';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { isItemActive, type NavGroup, type NavItem } from '@/lib/nav';

/**
 * Kumo folds a group label down to a divider when the rail collapses, which moves the icons under it. This
 * keeps the label's height and swaps the text for a rule drawn across the same line, so a hover-peek
 * doesn't jolt them.
 */
const GROUP_LABEL = [
  'relative my-0! grid-rows-[1fr]! border-transparent!',
  'after:absolute after:inset-x-0 after:bottom-[18px] after:border-b after:border-border',
  'after:opacity-0 after:transition-opacity after:duration-(--sidebar-animation-duration)',
  'group-data-[state=collapsed]/sidebar:after:opacity-100 group-data-[state=collapsed]/sidebar:text-transparent group-data-[state=collapsed]/sidebar:**:text-transparent',
  '[[data-sidebar=group]:first-child_&]:after:hidden',
].join(' ');

function Row({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const active = isItemActive(pathname, item);
  const Icon = item.icon;
  return (
    <Sidebar.MenuButton
      href={item.href}
      active={active}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      tooltip={item.label}
      icon={<Icon weight={active ? 'fill' : undefined} className={cn('size-4 shrink-0', active ? 'text-primary' : 'opacity-60')} />}
    >
      {item.label}
    </Sidebar.MenuButton>
  );
}

function Groups({ groups, pathname, onNavigate }: { groups: NavGroup[]; pathname: string; onNavigate?: () => void }) {
  return groups.map((group) => (
    <Sidebar.Group key={group.key}>
      {group.label ? <Sidebar.GroupLabel className={GROUP_LABEL}>{group.label}</Sidebar.GroupLabel> : null}
      <Sidebar.Menu>
        {group.items.map((item) => (
          <Row key={item.key + item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </Sidebar.Menu>
    </Sidebar.Group>
  ));
}

/** The main menu: labelled groups of links, the current page filled. */
export function AppNav({ groups, label, onNavigate }: { groups: NavGroup[]; label: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex min-w-0 flex-col">
      <Groups groups={groups} pathname={pathname} onNavigate={onNavigate} />
    </nav>
  );
}

/** A drilled-in menu (Settings …): a back link on top, then the area's rows. */
export function AppSubNav({
  back,
  groups,
  label,
  header,
  onNavigate,
}: {
  back: { href: string; label: string };
  groups: NavGroup[];
  label: string;
  header?: ReactNode;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex min-w-0 flex-col">
      <Sidebar.Menu>
        <Sidebar.MenuButton
          href={back.href}
          onClick={onNavigate}
          icon={<CaretLeftIcon aria-hidden className="size-4 shrink-0 opacity-60" />}
        >
          {back.label}
        </Sidebar.MenuButton>
      </Sidebar.Menu>
      {header ? <div className="px-2 pt-3 pb-1 text-sm font-semibold group-data-[state=collapsed]/sidebar:hidden">{header}</div> : null}
      <Groups groups={groups} pathname={pathname} onNavigate={onNavigate} />
    </nav>
  );
}
