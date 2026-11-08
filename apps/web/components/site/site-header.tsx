import { buttonVariants } from '@app/ui/components/button';
import { LinkButton } from '@app/ui/components/link-button';
import { Logo } from '@app/ui/components/logo';
import Link from 'next/link';

import { SITE } from '@/lib/site';

import { SiteMobileMenu } from './site-mobile-menu';
import { ThemeSwitch } from '@/components/layout/theme-switch';

export const SITE_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/docs', label: 'Help' },
  { href: '/brand', label: 'Brand' },
];

/** The public header. Static (no per-visitor data) so the CDN can serve every page; /login knows who you are. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label={`${SITE.name} home`} className="shrink-0">
          <Logo name={SITE.name} />
        </Link>
        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
          {SITE_LINKS.slice(1).map((l) => (
            <Link key={l.href} href={l.href} className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-tint hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeSwitch compact />
          <Link href="/login" className={buttonVariants({ variant: 'ghost', className: 'hidden sm:inline-flex' })}>
            Sign in
          </Link>
          <LinkButton href="/account" variant="primary">
            Get started
          </LinkButton>
          <SiteMobileMenu links={SITE_LINKS} />
        </div>
      </div>
    </header>
  );
}
