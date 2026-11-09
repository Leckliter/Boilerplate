import { callAction, guestActor } from '@app/core';
import { listDocs } from '@app/core/docs';
import { getSiteUrl } from '@app/core/env';
import type { MetadataRoute } from 'next';

/** Public pages only. Add yours here (or generate them from your data). */
const PAGES = ['/', '/pricing', '/about', '/contact', '/terms', '/privacy', '/brand', '/docs'];

/** Pages plus every PUBLIC doc (a guest only gets public docs back, so internal ones never appear). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const docs = await callAction(listDocs, {}, guestActor('web'));
  const paths = [...PAGES, ...(docs.ok ? docs.data.docs.map((d) => `/docs/${d.slug}`) : [])];
  return paths.map((path) => ({
    url: `${base}${path === '/' ? '' : path}`,
    changeFrequency: 'monthly',
    priority: path === '/' ? 1 : 0.6,
  }));
}
