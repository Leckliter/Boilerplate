import path from 'node:path';

import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  // `NEXT_OUTPUT=standalone` (the Dockerfile sets it) builds a self-contained server in .next/standalone.
  // Left unset, Vercel and `next start` behave as usual. docs/deploy.md.
  ...(process.env.NEXT_OUTPUT === 'standalone' && {
    output: 'standalone' as const,
    // Trace from the repo root so the workspace packages are included.
    outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  }),
  // The e2e suite runs its own dev server in another folder so it never fights `pnpm dev` for the lock.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ['@app/ui', '@app/core', '@app/db'],
  poweredByHeader: false,
  experimental: {
    // Keep server code un-minified so stack traces in error reports name real
    // functions (docs/errors.md). Server bundle size doesn't reach browsers.
    serverMinification: false,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
