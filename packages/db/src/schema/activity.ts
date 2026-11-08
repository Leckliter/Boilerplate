import { boolean, index, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { apiKeys } from './api-keys';
import { contacts } from './contacts';
import { app, id } from './_shared';

export const actorKind = app.enum('actor_kind', ['user', 'api_key', 'system', 'guest']);
export const actionChannel = app.enum('action_channel', [
  'web',
  'api',
  'mcp',
  'system',
  'cli',
  'automation',
]);
/**
 * - change — an action that changes data (always logged, success or failure)
 * - read   — an action that only reads (logged when an API key / AI runs it)
 * - auth   — sign-in, sign-out, sign-up, password changes …
 */
export const activityKind = app.enum('activity_kind', ['change', 'read', 'auth']);

/**
 * THE audit trail: one row per thing someone did — who (a person, an API key /
 * AI, or the system), through which channel, from where, to what, and whether
 * it worked. Field-level before/after values live in `change_log`, linked by
 * `change_log.activity_id = activity_log.id`.
 *
 * Written by `runAction` (every change, every denied attempt, every API/MCP
 * call) and by the auth flow (sign-in, sign-out …). Never updated or deleted
 * by the app.
 */
export const activityLog = app
  .table(
    'activity_log',
    {
      id: id(),
      occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
      kind: activityKind('kind').notNull().default('change'),
      action: text('action').notNull(),
      actorKind: actorKind('actor_kind').notNull(),
      actorContactId: uuid('actor_contact_id').references(() => contacts.id, {
        onDelete: 'set null',
      }),
      apiKeyId: uuid('api_key_id').references(() => apiKeys.id, { onDelete: 'set null' }),
      channel: actionChannel('channel').notNull(),
      subjectType: text('subject_type'),
      subjectId: uuid('subject_id'),
      summary: text('summary'),
      input: jsonb('input'),
      ok: boolean('ok').notNull(),
      /** Human-readable failure message. */
      error: text('error'),
      /** Machine-readable failure: forbidden, invalid_input, not_found, conflict, internal … */
      errorCode: text('error_code'),
      /** For `internal` failures: the error report reference (`app.error_events.ref`). */
      errorRef: text('error_ref'),
      /** Ties together everything one web/API request did (Vercel's request id when available). */
      requestId: text('request_id'),
      ip: text('ip'),
      userAgent: text('user_agent'),
      durationMs: integer('duration_ms'),
    },
    (t) => [
      index('activity_log_occurred_at_idx').on(t.occurredAt),
      index('activity_log_subject_idx').on(t.subjectType, t.subjectId),
      index('activity_log_actor_idx').on(t.actorContactId),
      index('activity_log_api_key_idx').on(t.apiKeyId),
      index('activity_log_request_idx').on(t.requestId),
    ],
  )
  .enableRLS();

export type ActivityEntry = typeof activityLog.$inferSelect;

/**
 * Field-level history of every row in the `app` schema, written by a Postgres
 * trigger (`app.record_change`, see migration 0009) — so it also catches
 * writes that don't go through an action (sign-in linking, seeds, data fixes
 * run in the SQL editor …).
 *
 * - `activity_id` links to the action that made the change; null means the
 *   write happened outside an action (see `db_user`).
 * - `before` / `after` hold only the columns that changed on update, the
 *   whole row on insert / delete. Secrets (e.g. API key hashes) are left out.
 * - `subject_id` is the record whose history this belongs to (a contact for
 *   `contact_tags`, a product for `product_offers` …).
 */
export const changeLog = app
  .table(
    'change_log',
    {
      id: id(),
      occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
      activityId: uuid('activity_id'),
      tableName: text('table_name').notNull(),
      rowId: text('row_id'),
      subjectId: uuid('subject_id'),
      op: text('op').notNull(),
      before: jsonb('before'),
      after: jsonb('after'),
      dbUser: text('db_user').notNull(),
    },
    (t) => [
      index('change_log_activity_idx').on(t.activityId),
      index('change_log_subject_idx').on(t.subjectId, t.occurredAt),
      index('change_log_occurred_at_idx').on(t.occurredAt),
    ],
  )
  .enableRLS();

export type ChangeEntry = typeof changeLog.$inferSelect;
