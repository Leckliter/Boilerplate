import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { createDb } from './client';

export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../migrations', import.meta.url));

/**
 * Apply every pending migration in packages/db/migrations to any Postgres (`url`).
 * Used by `pnpm db:migrate`, the Vercel build and the tests' global setup.
 * Migrations are plain SQL with no provider-specific schema in them, so they run on
 * Neon, Supabase or a local Postgres alike.
 */
export async function runMigrations(url: string): Promise<void> {
  const { db, end } = createDb(url, { max: 1 });
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER, migrationsSchema: 'drizzle' });
  } finally {
    await end();
  }
}
