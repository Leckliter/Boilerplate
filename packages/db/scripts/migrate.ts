/**
 * Applies pending migrations in ./migrations to any Postgres.
 *
 *   pnpm db:migrate
 *
 * Uses DATABASE_URL_DIRECT (a direct / session connection) when set, else DATABASE_URL.
 * Never hand-edit a migration that has been applied: generate a new one (pnpm db:generate).
 */
import { runMigrations } from '../src/migrate';

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

console.log(`Applying migrations to ${new URL(url).host} …`);
await runMigrations(url);
console.log('Migrations up to date.');
