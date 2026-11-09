#!/usr/bin/env node
/**
 * The database the e2e suite runs against: created if missing, migrated, seeded.
 *
 *   node scripts/e2e-db.mjs            # prepare it and print its URL
 *   node scripts/e2e-db.mjs --url      # only print the URL (no side effects)
 *
 * URL: E2E_DATABASE_URL, else DATABASE_URL with the database renamed `<name>_e2e` (so `pnpm test`,
 * which wipes its database, never shares data with the browser tests), else the throw-away local
 * Postgres from packages/db/scripts/test-db.mjs (database `app_e2e`). Always a localhost database:
 * the database is dropped and recreated on every run (E2E_KEEP_DB=1 keeps it).
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const onlyUrl = process.argv.includes('--url');

export function e2eDatabaseUrl() {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  const base = process.env.DATABASE_URL;
  if (base) {
    const u = new URL(base);
    if (!u.pathname.endsWith('_e2e')) u.pathname = `${u.pathname}_e2e`;
    return u.toString();
  }
  return 'postgres://postgres:postgres@localhost:5544/app_e2e';
}

function assertLocal(url) {
  if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(url).hostname)) {
    throw new Error(`Refusing to run e2e against a non-local database (${new URL(url).host}).`);
  }
}

function run(cmd, args, env = {}) {
  const res = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (res.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (${res.status})`);
}

export async function prepareE2eDatabase() {
  const url = e2eDatabaseUrl();
  assertLocal(url);
  const target = new URL(url);
  // The local throw-away Postgres is started on demand (a no-op when something already answers).
  if (!process.env.DATABASE_URL && !process.env.E2E_DATABASE_URL) {
    run('node', ['packages/db/scripts/test-db.mjs'], { PG_DB: 'app_e2e' });
  }
  // Create the database when it is missing (connect to the maintenance database `postgres`).
  const requireFromDb = createRequire(path.join(root, 'packages/db/package.json'));
  const postgres = requireFromDb('postgres');
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} });
  try {
    const name = decodeURIComponent(target.pathname.slice(1));
    const quoted = `"${name.replace(/"/g, '""')}"`;
    const found = await sql`SELECT 1 FROM pg_database WHERE datname = ${name}`;
    // A fresh database every run, so a test that went wrong last time (a lost owner role, a half-made
    // record) cannot poison this one. E2E_KEEP_DB=1 keeps it, for looking around after a failure.
    if (found.length > 0 && !process.env.E2E_KEEP_DB) {
      await sql.unsafe(`DROP DATABASE ${quoted} WITH (FORCE)`);
      found.length = 0;
    }
    if (found.length === 0) await sql.unsafe(`CREATE DATABASE ${quoted}`);
  } finally {
    await sql.end();
  }
  const env = {
    DATABASE_URL: url,
    NODE_ENV: 'development',
    OWNER_EMAILS: 'owner@example.com',
  };
  run('pnpm', ['--silent', 'db:migrate'], env);
  run('pnpm', ['--silent', 'db:seed'], env);
  return url;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (onlyUrl) console.log(e2eDatabaseUrl());
  else console.log(await prepareE2eDatabase());
}
