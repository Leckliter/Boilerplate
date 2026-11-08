import { index, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { contacts } from './contacts';
import { app, createdAt, id } from './_shared';

/**
 * Keys for the REST API and the MCP server. A key acts AS its owner contact,
 * optionally narrowed to a subset of the owner's permissions. Only a SHA-256
 * hash of the key is stored; the full key is shown once at creation.
 */
export const apiKeys = app
  .table(
    'api_keys',
    {
      id: id(),
      contactId: uuid('contact_id')
        .notNull()
        .references(() => contacts.id, { onDelete: 'cascade' }),
      name: text('name').notNull(),
      /** First characters of the key, safe to display (e.g. `app_sk_ab12`). */
      prefix: text('prefix').notNull(),
      keyHash: text('key_hash').notNull().unique(),
      /** null = all of the owner's permissions. */
      permissions: text('permissions').array(),
      lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
      expiresAt: timestamp('expires_at', { withTimezone: true }),
      revokedAt: timestamp('revoked_at', { withTimezone: true }),
      createdAt: createdAt(),
    },
    (t) => [index('api_keys_contact_id_idx').on(t.contactId)],
  )
  .enableRLS();

export type ApiKey = typeof apiKeys.$inferSelect;
