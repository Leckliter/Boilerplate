'use client';

import { IconProvider } from '@app/ui/components/icons';
import { TooltipProvider } from '@app/ui/components/tooltip';
import { type LinkComponentProps, LinkProvider, PortalProvider } from '@app/ui/components/ui-context';
import NextLink from 'next/link';
import { forwardRef, type ReactNode, useState } from 'react';

/** Links inside @app/ui components (breadcrumbs, tabs, pagination …) navigate with Next's router. */
const AppLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(function AppLink(
  { to, href, ...rest },
  ref,
) {
  return <NextLink ref={ref} href={href ?? to ?? '#'} {...rest} />;
});

/**
 * The providers every @app/ui component expects, mounted once in the root layout: icon weight, which
 * component renders links (next/link), where popups render, and tooltips.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  return (
    <IconProvider>
      <LinkProvider component={AppLink}>
        <PortalProvider container={portal}>
          <TooltipProvider>{children}</TooltipProvider>
        </PortalProvider>
        <div ref={setPortal} data-portal-root />
      </LinkProvider>
    </IconProvider>
  );
}
