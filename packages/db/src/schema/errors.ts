import { index, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { actionChannel, actorKind } from './activity';
import { apiKeys } from './api-keys';
import { contacts } from './contacts';
import { app, id } from './_shared';

export const errorSource = app.enum('error_source', [
  'action', // an action threw something unexpected
  'request', // a page, route handler or server action crashed (Next.js onRequestError)
  'client', // the browser reported a crash
  'webhook', // an incoming webhook failed outside an action
  'job', // a script or background job
]);

/**
 * One row per unexpected failure (a bug or an outage — not "you don't have
 * permission" or "that email is taken", which are normal answers).
 *
 * The person who hit it sees `ref` (e.g. `E-7K3QX9MD`). Give that to an AI
 * agent: `errors.get` returns everything needed to fix it — the stack, the
 * input, who/where/when, the deployed commit, and a diagnosis (`code`, `hint`).
 * Occurrences of the same bug share a `fingerprint`.
 */
export const errorEvents = app
  .table(
    'error_events',
    {
      id: id(),
      /** Short reference shown to people, e.g. `E-7K3QX9MD`. */
      ref: text('ref').notNull().unique(),
      occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
      source: errorSource('source').notNull(),
      /** Diagnosis category, e.g. `db.missing_table`, `stripe.auth`, `code.unhandled`. */
      code: text('code').notNull(),
      /** What the diagnosis suggests doing — written for the AI agent fixing it. */
      hint: text('hint'),
      /** Same bug → same fingerprint (code + error type + normalised message + first app frame). */
      fingerprint: text('fingerprint').notNull(),
      errorName: text('error_name'),
      message: text('message').notNull(),
      stack: text('stack'),
      /** The `cause` chain, innermost last: [{ name, message, code, … }]. */
      causes: jsonb('causes'),
      environment: text('environment').notNull(),
      /** Git commit deployed when it happened (VERCEL_GIT_COMMIT_SHA). */
      release: text('release'),
      action: text('action'),
      path: text('path'),
      method: text('method'),
      /** Next.js error digest — what error pages show for server crashes. */
      digest: text('digest'),
      requestId: text('request_id'),
      actorKind: actorKind('actor_kind'),
      actorContactId: uuid('actor_contact_id').references(() => contacts.id, {
        onDelete: 'set null',
      }),
      apiKeyId: uuid('api_key_id').references(() => apiKeys.id, { onDelete: 'set null' }),
      channel: actionChannel('channel'),
      /** The action input (secrets redacted). */
      input: jsonb('input'),
      /** Anything else known: route, browser URL, component stack, request id of an outside service … */
      context: jsonb('context'),
      ip: text('ip'),
      userAgent: text('user_agent'),
      resolvedAt: timestamp('resolved_at', { withTimezone: true }),
      resolvedBy: uuid('resolved_by').references(() => contacts.id, { onDelete: 'set null' }),
      /** What fixed it (commit, PR, note). */
      resolution: text('resolution'),
    },
    (t) => [
      index('error_events_occurred_at_idx').on(t.occurredAt),
      index('error_events_fingerprint_idx').on(t.fingerprint, t.occurredAt),
      index('error_events_digest_idx').on(t.digest),
      index('error_events_request_idx').on(t.requestId),
    ],
  )
  .enableRLS();

export type ErrorEvent = typeof errorEvents.$inferSelect;
