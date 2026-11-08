import { getSiteUrl } from '@app/core/env';
import type { MetadataRoute } from 'next';

/** Public pages only. Add yours here (or generate them from your data). */
const PAGES = ['/', '/pricing', '/about', '/brand', '/docs'];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  return PAGES.map((path) => ({ url: `${base}${path === '/' ? '' : path}`, changeFrequency: 'monthly' }));
}
