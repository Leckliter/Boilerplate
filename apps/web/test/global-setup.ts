import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// rules-ok: no-db-in-web — route tests seed and inspect the local test database directly
import { createDb, sql } from '@app/db';
// rules-ok: no-db-in-web — route tests seed and inspect the local test database directly
import { runMigrations } from '@app/db/migrate';

/**
 * Before the route tests: start (or reuse) the local Postgres, use a database of our OWN
 * (`app_test_web`, so `pnpm test` can run this and the core tests at the same time without one
 * dropping the other's schema), and apply every migration to a fresh `app` schema.
 * Tests refuse any database that isn't on localhost (they truncate tables).
 */
export default async function setup() {
  const helper = fileURLToPath(
    new URL('../../../packages/db/scripts/test-db.mjs', import.meta.url),
  );
  // The helper reuses a local DATABASE_URL when set; we want our own database, so hide it.
  const env = { ...process.env, PG_DB: 'app_test_web' } as NodeJS.ProcessEnv;
  delete env.DATABASE_URL;
  const url = execFileSync('node', [helper], { encoding: 'utf8', env }).trim().split('\n').pop()!;
  process.env.DATABASE_URL = url;

  const { db, end } = createDb(url, { max: 1 });
  try {
    await db.execute(sql`drop schema if exists app cascade`);
    await db.execute(sql`drop schema if exists drizzle cascade`);
  } finally {
    await end();
  }
  await runMigrations(url);
}
