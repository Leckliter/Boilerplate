import './globals.css';

import { getSiteUrl, isProduction } from '@app/core/env';
import { DialogsHost } from '@app/ui/components/alert-dialog';
import { SkipLink } from '@app/ui/components/skip-link';
import { Toaster } from '@app/ui/components/toaster';
import { getAppTimeZone, setAppTimeZone } from '@app/ui/lib/dates';
import { THEME_COLORS } from '@app/ui/lib/theme-colors';
import type { Metadata, Viewport } from 'next';
import { Geist_Mono, Inter } from 'next/font/google';

import { AppProviders } from '@/components/app-providers';
import { SITE } from '@/lib/site';
import { themeScript } from '@/lib/theme';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: SITE.description,
  metadataBase: new URL(getSiteUrl()),
  openGraph: { type: 'website', siteName: SITE.name, description: SITE.description },
  // Only production is for search engines (robots.ts says the same).
  ...(!isProduction() && { robots: { index: false, follow: false } }),
};

export const viewport: Viewport = { themeColor: THEME_COLORS.brand };

// Dates are shown in the app's time zone on the server too (the server runs in UTC).
if (process.env.APP_TIME_ZONE) setAppTimeZone(process.env.APP_TIME_ZONE);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AppProviders timeZone={getAppTimeZone()}>
          <SkipLink />
          {children}
          <Toaster />
          <DialogsHost />
        </AppProviders>
      </body>
    </html>
  );
}
