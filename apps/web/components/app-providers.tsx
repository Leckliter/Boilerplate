'use client';

import { IconProvider } from '@app/ui/components/icons';
import { TooltipProvider } from '@app/ui/components/tooltip';
import {
  type LinkComponentProps,
  LinkProvider,
  PortalProvider,
  TimeZoneProvider,
} from '@app/ui/components/ui-context';
import { NextIntlClientProvider } from 'next-intl';
import NextLink from 'next/link';
import { forwardRef, type ReactNode, useState } from 'react';

import en from '@/messages/en.json';

/** Links inside @app/ui components (breadcrumbs, tabs, pagination …) navigate with Next's router. */
const AppLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(function AppLink(
  { to, href, ...rest },
  ref,
) {
  return <NextLink ref={ref} href={href ?? to ?? '#'} {...rest} />;
});

/**
 * The providers every @app/ui component expects, mounted once in the root layout: icon weight, the time
 * zone client components format dates in (the server's, so both sides agree; a signed-in person's own
 * choice is layered on top in the account/admin shell), which component renders links (next/link), where
 * popups render, and tooltips. It also gives every client component English messages as a default, so a
 * shared component (the theme switch, a form) can use `useTranslations` on the public site and /brand, which
 * stay static (no cookie read); the account, admin and sign-in layouts mount the real, per-person provider
 * inside this one.
 */
export function AppProviders({ children, timeZone }: { children: ReactNode; timeZone: string }) {
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  return (
    <NextIntlClientProvider locale="en" messages={en} timeZone={timeZone}>
      <IconProvider>
        <TimeZoneProvider zone={timeZone}>
          <LinkProvider component={AppLink}>
            <PortalProvider container={portal}>
              <TooltipProvider>{children}</TooltipProvider>
            </PortalProvider>
            <div ref={setPortal} data-portal-root />
          </LinkProvider>
        </TimeZoneProvider>
      </IconProvider>
    </NextIntlClientProvider>
  );
}
