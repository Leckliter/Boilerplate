import { boolean, index, integer, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { contacts } from './contacts';
import { app, createdAt, id } from './_shared';

/**
 * - `type`  — what a contact IS (customer, lead, prospect, staff, contractor).
 *             These drive the Contacts menu in /admin.
 * - `label` — free-form descriptors (VIP, net-30, do-not-text, …).
 *
 * Tags DESCRIBE people. They never grant access — see access.ts for that.
 */
export const tagKind = app.enum('tag_kind', ['type', 'label']);

export const tags = app
  .table('tags', {
    id: id(),
    /** Stable machine name used in code and by AI, e.g. `customer`. */
    slug: text('slug').notNull().unique(),
    label: text('label').notNull(),
    kind: tagKind('kind').notNull().default('label'),
    description: text('description'),
    /** A brand palette key (see packages/ui tag colors), not a hex code. */
    color: text('color').notNull().default('neutral'),
    sortOrder: integer('sort_order').notNull().default(100),
    /** System tags are created by migrations and can't be deleted. */
    system: boolean('system').notNull().default(false),
    createdAt: createdAt(),
  })
  .enableRLS();

export const contactTags = app
  .table(
    'contact_tags',
    {
      contactId: uuid('contact_id')
        .notNull()
        .references(() => contacts.id, { onDelete: 'cascade' }),
      tagId: uuid('tag_id')
        .notNull()
        .references(() => tags.id, { onDelete: 'cascade' }),
      addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
      addedBy: uuid('added_by').references(() => contacts.id, { onDelete: 'set null' }),
    },
    (t) => [
      primaryKey({ columns: [t.contactId, t.tagId] }),
      index('contact_tags_tag_id_idx').on(t.tagId),
    ],
  )
  .enableRLS();

export type Tag = typeof tags.$inferSelect;
