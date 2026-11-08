import { AsyncLocalStorage } from 'node:async_hooks';

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

/**
 * Server-only Postgres connection over plain `DATABASE_URL` (Neon or Supabase in the cloud,
 * plain Postgres on localhost for development and tests). Provider-neutral. Pooled/transaction
 * connection strings (Neon `-pooler`, Supabase port 6543) don't support prepared statements,
 * hence `prepare: false`.
 */
export function createDb(url: string, opts: { max?: number } = {}) {
  const client = postgres(url, {
    prepare: false,
    // A few per Vercel instance (the provider's pooler shares them out), so one slow
    // request can't hold up every other request the instance is serving.
    max: opts.max ?? (process.env.VERCEL ? 5 : 10),
    // Serverless: an instance can sit frozen between requests while the provider's pooler drops
    // the idle connection. Reusing that dead socket hung every request on the instance until
    // Vercel's 300 s timeout. So close idle connections before the pooler does, recycle
    // them regularly, and never wait long to connect.
    idle_timeout: 20,
    max_lifetime: 60 * 5,
    connect_timeout: 10,
    // Keep Postgres' NOTICE chatter (e.g. "schema already exists") out of logs.
    onnotice: () => {},
  });
  const db = drizzle({ client, schema, casing: 'snake_case' });
  // Remember (per async call chain) that a transaction is open, so getDb() can refuse
  // to be used inside one — see `getDb`.
  const transaction = db.transaction.bind(db);
  db.transaction = ((run, config) =>
    transaction((tx) => inTransaction.run(true, () => run(tx)), config)) as typeof db.transaction;
  return { db, end: () => client.end() };
}

/**
 * True while the current code runs inside `db.transaction(…)`. On Vercel each instance has a
 * small pool (see `max` above) and the transaction already holds one connection: a query
 * through getDb() there needs another, and once the pool is busy it waits forever — every
 * other request on that instance then queues behind it until Vercel kills them at 300 s.
 * Inside a transaction, use its `tx`.
 */
const inTransaction = new AsyncLocalStorage<boolean>();

export type Db = ReturnType<typeof createDb>['db'];
/** A transaction handle — has the same query API as Db. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

let instance: Db | undefined;

/** The shared database client. Created lazily so builds don't need a DATABASE_URL. */
export function getDb(): Db {
  if (inTransaction.getStore() && guardOn()) {
    throw new Error(
      'getDb() was called inside a transaction: on Vercel (a small pool) this can hang forever. ' +
        'Pass the transaction (`tx`) down and query with it instead.',
    );
  }
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set. See .env.example.');
    instance = createDb(url).db;
  }
  return instance;
}

/** The guard throws in tests and development; in production a stuck request is better than a refused one. */
const guardOn = () =>
  process.env.NODE_ENV === 'test' ||
  Boolean(process.env.VITEST) ||
  process.env.NODE_ENV === 'development';
