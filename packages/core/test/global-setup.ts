import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createDb, sql } from '@app/db';
import { runMigrations } from '@app/db/migrate';

import { COVERAGE_DIR } from './action-coverage';

/**
 * Before the whole run:
 * 1. start (or reuse) a local Postgres and set DATABASE_URL, unless DATABASE_URL already points at one;
 * 2. throw away the `app` schema and apply every migration to a fresh one;
 * 3. start a clean action-coverage record (see action-coverage.ts).
 * Tests refuse any database that isn't on localhost (they truncate tables).
 */
export default async function setup() {
  rmSync(COVERAGE_DIR, { recursive: true, force: true });

  let url = process.env.DATABASE_URL;
  if (!url || !/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    const helper = fileURLToPath(new URL('../../db/scripts/test-db.mjs', import.meta.url));
    url = execFileSync('node', [helper], { encoding: 'utf8' }).trim().split('\n').pop()!;
    process.env.DATABASE_URL = url;
  }

  const { db, end } = createDb(url, { max: 1 });
  try {
    await db.execute(sql`drop schema if exists app cascade`);
    await db.execute(sql`drop schema if exists drizzle cascade`);
  } finally {
    await end();
  }
  await runMigrations(url);
}
