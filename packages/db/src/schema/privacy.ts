import { sql } from 'drizzle-orm';
import { index, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { contacts } from './contacts';
import { app, createdAt, id, updatedAt } from './_shared';

export const deletionStatus = app.enum('deletion_status', [
  'pending', // waiting out the grace period; the person can still cancel
  'cancelled',
  'completed', // the contact was anonymised
]);

/**
 * "Delete my account": the request, and when the daily maintenance job will anonymise the
 * contact (`scheduled_for`, after the `account.deletionGraceDays` setting, default 14). The contact
 * row itself is kept (history points at it) but its personal data is wiped. One OPEN request per
 * contact (cancelled / completed ones stay as history).
 */
export const deletionRequests = app
  .table(
    'deletion_requests',
    {
      id: id(),
      contactId: uuid('contact_id')
        .notNull()
        .references(() => contacts.id, { onDelete: 'cascade' }),
      status: deletionStatus('status').notNull().default('pending'),
      reason: text('reason'),
      requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
      scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
      cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
      completedAt: timestamp('completed_at', { withTimezone: true }),
      /** Why a due request was not carried out (e.g. the last owner). */
      note: text('note'),
      createdAt: createdAt(),
      updatedAt: updatedAt(),
    },
    (t) => [
      index('deletion_requests_due_idx').on(t.status, t.scheduledFor),
      uniqueIndex('deletion_requests_open_key')
        .on(t.contactId)
        .where(sql`${t.status} = 'pending'`),
    ],
  )
  .enableRLS();

export type DeletionRequest = typeof deletionRequests.$inferSelect;
