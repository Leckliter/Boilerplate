import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  // Only our `app` schema. The auth provider's schema (neon_auth / auth) is never ours.
  schemaFilter: ['app'],
  dbCredentials: { url: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL ?? '' },
  migrations: { schema: 'drizzle' },
  strict: true,
  verbose: true,
});
