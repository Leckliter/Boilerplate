import { Logo } from '@app/ui/components/logo';
import { NextIntlClientProvider } from 'next-intl';
import Link from 'next/link';

import { SITE } from '@/lib/site';

/** Sign in: a centred card on the page background. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider>
      <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12">
        <Link href="/" aria-label={`${SITE.name} home`}>
          <Logo name={SITE.name} />
        </Link>
        <main
          id="main-content"
          tabIndex={-1}
          className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xs"
        >
          {children}
        </main>
        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to the{' '}
          <Link href="/terms" className="underline underline-offset-4">
            terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline underline-offset-4">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </NextIntlClientProvider>
  );
}
