import { primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';

import { contacts } from './contacts';
import { app } from './_shared';

/**
 * Roles grant access to the staff app (/admin). What each role may do is defined in code:
 * packages/core/src/access/permissions.ts.
 *
 * A contact with no roles is a customer-only account: they can use the website and
 * /account, nothing else. Every contact with a login gets /account.
 */
export const appRole = app.enum('app_role', ['owner', 'admin', 'manager', 'staff']);

export const contactRoles = app
  .table(
    'contact_roles',
    {
      contactId: uuid('contact_id')
        .notNull()
        .references(() => contacts.id, { onDelete: 'cascade' }),
      role: appRole('role').notNull(),
      grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
      grantedBy: uuid('granted_by').references(() => contacts.id, { onDelete: 'set null' }),
    },
    (t) => [primaryKey({ columns: [t.contactId, t.role] })],
  )
  .enableRLS();

export type AppRole = (typeof appRole.enumValues)[number];
