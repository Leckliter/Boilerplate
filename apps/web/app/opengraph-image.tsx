import { THEME_COLORS } from '@app/ui/lib/theme-colors';
import { ImageResponse } from 'next/og';

import { SITE } from '@/lib/site';

export const alt = SITE.name;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * The social-sharing image (Open Graph / Twitter) for every page without its own: the app name and tagline
 * on the brand colour. Rendered at build/request time by next/og, so it follows SITE and THEME_COLORS.
 * Image rendering needs literal colours, which is exactly what THEME_COLORS is for.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 80,
        background: THEME_COLORS.brand,
        color: THEME_COLORS.background,
      }}
    >
      <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1 }}>{SITE.name}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
          {SITE.tagline}
        </div>
        <div style={{ fontSize: 32, opacity: 0.85 }}>{SITE.description}</div>
      </div>
    </div>,
    size,
  );
}
