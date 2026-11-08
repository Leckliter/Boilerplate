#!/usr/bin/env node
/**
 * Starts (or reuses) a throw-away local Postgres 16 for tests and prints its DATABASE_URL.
 *
 *   node packages/db/scripts/test-db.mjs            # start/reuse, print the URL
 *   node packages/db/scripts/test-db.mjs --stop     # stop it
 *   eval "$(node packages/db/scripts/test-db.mjs --env)"   # export DATABASE_URL into your shell
 *
 * Binaries: PG_BIN or /usr/lib/postgresql/16/bin (Debian/Ubuntu `postgresql-16`). The data
 * directory (PG_DATA, default /tmp/app-test-pg) lives outside the repo. Port PG_PORT (5544).
 * If DATABASE_URL already points at a local Postgres that answers, it is used as is.
 * Tests refuse anything that isn't localhost (they truncate tables).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, chownSync } from 'node:fs';

const BIN = process.env.PG_BIN ?? '/usr/lib/postgresql/16/bin';
const DATA = process.env.PG_DATA ?? '/tmp/app-test-pg';
const PORT = process.env.PG_PORT ?? '5544';
const DB = process.env.PG_DB ?? 'app_test';
const url = `postgres://postgres:postgres@localhost:${PORT}/${DB}`;
const args = process.argv.slice(2);

const asRoot = process.getuid?.() === 0;
/** Postgres refuses to run as root: run through `su postgres` then. */
function pg(cmd, cmdArgs, opts = {}) {
  const bin = `${BIN}/${cmd}`;
  if (asRoot) {
    const line = [bin, ...cmdArgs].map((a) => `'${String(a).replace(/'/g, `'\\''`)}'`).join(' ');
    return spawnSync('su', ['postgres', '-s', '/bin/bash', '-c', line], {
      encoding: 'utf8',
      ...opts,
    });
  }
  return spawnSync(bin, cmdArgs, { encoding: 'utf8', ...opts });
}
const ready = () => pg('pg_isready', ['-h', 'localhost', '-p', PORT, '-q']).status === 0;

if (args.includes('--stop')) {
  if (existsSync(DATA)) pg('pg_ctl', ['-D', DATA, 'stop', '-m', 'fast']);
  process.exit(0);
}

function start() {
  if (ready()) return;
  if (!existsSync(`${BIN}/initdb`)) {
    console.error(`No Postgres binaries in ${BIN}. Install postgresql-16 or set PG_BIN.`);
    process.exit(1);
  }
  if (!existsSync(`${DATA}/PG_VERSION`)) {
    mkdirSync(DATA, { recursive: true });
    if (asRoot) {
      const { uid, gid } = JSON.parse(
        execFileSync(
          'node',
          [
            '-e',
            `const {execSync}=require('child_process');console.log(JSON.stringify({uid:+execSync('id -u postgres'),gid:+execSync('id -g postgres')}))`,
          ],
          { encoding: 'utf8' },
        ),
      );
      chownSync(DATA, uid, gid);
    }
    const init = pg('initdb', ['-D', DATA, '-U', 'postgres', '--auth=trust', '-E', 'UTF8']);
    if (init.status !== 0) throw new Error(`initdb failed: ${init.stderr}`);
  }
  const started = pg('pg_ctl', [
    '-D',
    DATA,
    '-l',
    `${DATA}/server.log`,
    '-w',
    '-o',
    `-p ${PORT} -c listen_addresses=localhost -c fsync=off -c synchronous_commit=off -c full_page_writes=off`,
    'start',
  ]);
  if (started.status !== 0)
    throw new Error(`pg_ctl start failed: ${started.stdout}${started.stderr}`);
}

function ensureDatabase() {
  const has = pg('psql', [
    '-h',
    'localhost',
    '-p',
    PORT,
    '-U',
    'postgres',
    '-tAc',
    `SELECT 1 FROM pg_database WHERE datname = '${DB}'`,
  ]);
  if (!has.stdout.includes('1')) {
    const made = pg('createdb', ['-h', 'localhost', '-p', PORT, '-U', 'postgres', DB]);
    if (made.status !== 0) throw new Error(`createdb failed: ${made.stderr}`);
  }
}

// An existing local DATABASE_URL that answers wins.
const existing = process.env.DATABASE_URL;
if (existing && /@(localhost|127\.0\.0\.1)[:/]/.test(existing) && !args.includes('--force')) {
  const { hostname, port } = new URL(existing);
  if (pg('pg_isready', ['-h', hostname, '-p', port || '5432', '-q']).status === 0) {
    print(existing);
    process.exit(0);
  }
}
start();
ensureDatabase();
print(url);

function print(u) {
  if (args.includes('--env')) console.log(`export DATABASE_URL='${u}'`);
  else console.log(u);
}
