import { getSiteUrl } from '@app/core/env';

import { JsonLd } from '@/components/site/json-ld';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { SITE } from '@/lib/site';

/**
 * The public website: header (banner), page (main), footer (contentinfo). The skip link in the root layout
 * jumps to `#main-content`. The /docs pages render inside it too. Static: it reads nothing per visitor.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const url = getSiteUrl();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <SiteFooter />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Organization',
              '@id': `${url}/#org`,
              name: SITE.name,
              url,
              description: SITE.description,
            },
            {
              '@type': 'WebSite',
              '@id': `${url}/#site`,
              name: SITE.name,
              url,
              publisher: { '@id': `${url}/#org` },
            },
          ],
        }}
      />
    </div>
  );
}
