import { Logo } from '@app/ui/components/logo';
import Link from 'next/link';

import { SITE } from '@/lib/site';

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[1.5fr_1fr_1fr] sm:px-6">
        <div className="grid content-start gap-3">
          <Logo name={SITE.name} />
          <p className="max-w-xs text-sm text-muted-foreground">{SITE.tagline}</p>
        </div>
        <nav aria-label="Product" className="grid content-start gap-2 text-sm">
          <p className="font-semibold">Product</p>
          <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
            Pricing
          </Link>
          <Link href="/docs" className="text-muted-foreground hover:text-foreground">
            Help
          </Link>
          <Link href="/brand" className="text-muted-foreground hover:text-foreground">
            Brand &amp; UI kit
          </Link>
        </nav>
        <nav aria-label="Company" className="grid content-start gap-2 text-sm">
          <p className="font-semibold">Company</p>
          <Link href="/about" className="text-muted-foreground hover:text-foreground">
            About
          </Link>
          <Link href="/terms" className="text-muted-foreground hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
            Privacy
          </Link>
        </nav>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} {SITE.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
