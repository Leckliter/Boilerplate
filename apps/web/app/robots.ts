import { getSiteUrl, isProduction } from '@app/core/env';
import type { MetadataRoute } from 'next';

/** Only production is indexed; the app areas and the API are never. */
export default function robots(): MetadataRoute.Robots {
  if (!isProduction()) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/account', '/api', '/login'] },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
