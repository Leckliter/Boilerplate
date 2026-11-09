import { Logo } from '@app/ui/components/logo';
import Link from 'next/link';

import { SITE } from '@/lib/site';

import { NewsletterForm } from './newsletter-form';

const link = 'text-muted-foreground transition-colors hover:text-foreground';

/**
 * The public footer: what the site is, where to go, a newsletter sign-up and a plain promise: no cookies
 * are set for visitors and nothing here tracks them (the only cookies are the sign-in and the
 * preferences you choose yourself).
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1.5fr]">
        <div className="grid content-start gap-3">
          <Logo name={SITE.name} />
          <p className="max-w-xs text-sm text-muted-foreground">{SITE.tagline}</p>
        </div>
        <nav aria-label="Product" className="grid content-start gap-2 text-sm">
          <p className="font-semibold">Product</p>
          <Link href="/pricing" className={link}>
            Pricing
          </Link>
          <Link href="/docs" className={link}>
            Help
          </Link>
          <Link href="/brand" className={link}>
            Brand &amp; UI kit
          </Link>
        </nav>
        <nav aria-label="Company" className="grid content-start gap-2 text-sm">
          <p className="font-semibold">Company</p>
          <Link href="/about" className={link}>
            About
          </Link>
          <Link href="/contact" className={link}>
            Contact
          </Link>
          <Link href="/terms" className={link}>
            Terms
          </Link>
          <Link href="/privacy" className={link}>
            Privacy
          </Link>
        </nav>
        <section aria-labelledby="newsletter-heading" className="grid content-start gap-2 text-sm">
          <h2 id="newsletter-heading" className="font-semibold">
            Newsletter
          </h2>
          <p className="text-muted-foreground">
            Occasional news. We email you a link to confirm, and every message has an unsubscribe
            link.
          </p>
          <NewsletterForm />
        </section>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-4 text-xs text-muted-foreground sm:px-6">
          <p>
            © {new Date().getFullYear()} {SITE.name}. All rights reserved.
          </p>
          <p>No tracking and no analytics: we don’t set cookies for visitors.</p>
        </div>
      </div>
    </footer>
  );
}
