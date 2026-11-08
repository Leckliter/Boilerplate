import { THEME_COLORS } from '@app/ui/lib/theme-colors';
import type { MetadataRoute } from 'next';

import { SITE } from '@/lib/site';

/** The installable app. Replace /icon.svg (and add PNGs in public/icons if you want maskable icons). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    start_url: '/account',
    scope: '/',
    display: 'standalone',
    background_color: THEME_COLORS.background,
    theme_color: THEME_COLORS.brand,
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
