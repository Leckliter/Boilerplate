import { Logo } from '@app/ui/components/logo';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { SITE } from '@/lib/site';

/** Sign in: a centred card on the page background. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('auth');
  return (
    <NextIntlClientProvider>
      <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12">
        <Link href="/">
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
          {t.rich('terms', {
            terms: (chunks) => (
              <Link href="/terms" className="underline underline-offset-4">
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href="/privacy" className="underline underline-offset-4">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </NextIntlClientProvider>
  );
}
