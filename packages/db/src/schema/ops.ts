import { boolean, index, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { contacts } from './contacts';
import { app, createdAt, id, updatedAt } from './_shared';

/**
 * One row per scheduled-job run (cron): `job` = `maintenance`, `jobs`, `notifications` …
 * `finished_at` null = still running or crashed; `ok = false` = it threw (`error` says why).
 * /api/healthcheck and Admin → System warn when a job's newest OK run is older than its
 * expected interval (packages/core/src/health.ts → CRONS). Written by `recordCronRun`.
 * Not change-tracked: it would drown the change log.
 */
export const cronRuns = app
  .table(
    'cron_runs',
    {
      id: id(),
      job: text('job').notNull(),
      startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
      finishedAt: timestamp('finished_at', { withTimezone: true }),
      ok: boolean('ok'),
      /** Small summary of the run (counts). */
      summary: jsonb('summary').notNull().default({}),
      error: text('error'),
    },
    (t) => [index('cron_runs_job_idx').on(t.job, t.startedAt)],
  )
  .enableRLS();

/**
 * Settings for outside services that staff switch on and off in Admin → Settings →
 * Integrations (kill switches, non-secret config). Whether a service is CONFIGURED
 * comes from environment variables (packages/core/src/env.ts → integrationStatus());
 * secrets never live here. One row per service, created the first time it's saved.
 */
export const integrations = app
  .table('integrations', {
    id: id(),
    /** Which service: `email`, `sms` … (a key from the env catalogue). */
    key: text('key').notNull().unique(),
    enabled: boolean('enabled').notNull().default(true),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    updatedByContactId: uuid('updated_by_contact_id').references(() => contacts.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  })
  .enableRLS();

/** Business settings, one JSON value per key (`business.name`, `notifications.quietHours` …). */
export const settings = app
  .table('settings', {
    id: id(),
    key: text('key').notNull().unique(),
    value: jsonb('value').notNull(),
    updatedByContactId: uuid('updated_by_contact_id').references(() => contacts.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  })
  .enableRLS();

export type CronRun = typeof cronRuns.$inferSelect;
export type Integration = typeof integrations.$inferSelect;
export type Setting = typeof settings.$inferSelect;
