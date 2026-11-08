import { integer, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

import { app } from './_shared';

/**
 * Counters behind action rate limits (`rateLimit` on an action, enforced by
 * `runAction`). One row per caller per action per time window, e.g.
 * `contacts.captureLead|ip:203.0.113.7` for the 10 minutes starting 14:20.
 *
 * Throwaway data: rows older than a day are deleted by the daily maintenance
 * job, and the table is not change-tracked (it would drown the change log).
 */
export const rateLimitHits = app
  .table(
    'rate_limit_hits',
    {
      key: text('key').notNull(),
      windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
      hits: integer('hits').notNull().default(1),
    },
    (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
  )
  .enableRLS();
