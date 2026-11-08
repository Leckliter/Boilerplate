'use client';

import { Avatar } from '@app/ui/components/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@app/ui/components/dropdown-menu';
import { SignOutIcon } from '@app/ui/components/icons';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useTransition } from 'react';

import { signOut } from '@/lib/auth/actions';
import type { AppDef } from '@/lib/nav';
import type { ThemeChoice } from '@/lib/theme';

import { applyTheme, useTheme } from './theme-switch';

/** The avatar menu: who you are, the other apps you can open, theme, sign out. */
export function UserMenu({
  name,
  email,
  apps,
  currentApp,
}: {
  name: string;
  email: string;
  apps: AppDef[];
  currentApp?: AppDef['id'];
}) {
  const t = useTranslations('shell');
  const tc = useTranslations('common');
  const tn = useTranslations('nav');
  const theme = useTheme();
  const [pending, start] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={tn('myAccount')}
        className="flex items-center rounded-full p-0.5 outline-none hover:bg-tint focus-visible:ring-[1.5px] focus-visible:ring-ring"
      >
        <Avatar name={name} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('apps')}</DropdownMenuLabel>
          {apps.map((app) => (
            <DropdownMenuLinkItem
              key={app.id}
              render={
                <Link href={app.href} aria-current={app.id === currentApp ? 'page' : undefined} />
              }
            >
              <app.icon weight={app.id === currentApp ? 'fill' : undefined} />
              {tn(app.key)}
            </DropdownMenuLinkItem>
          ))}
          <DropdownMenuLinkItem render={<Link href="/" />}>
            <span className="size-4" />
            {tn('backToSite')}
          </DropdownMenuLinkItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('theme')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme} onValueChange={(v) => applyTheme(v as ThemeChoice)}>
            <DropdownMenuRadioItem value="light">{t('light')}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">{t('dark')}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">{t('system')}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onClick={() => start(async () => void (await signOut()))}
        >
          <SignOutIcon />
          {tc('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
