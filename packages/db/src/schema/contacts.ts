import { sql } from 'drizzle-orm';
import { index, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { app, createdAt, id, updatedAt } from './_shared';

export const contactStatus = app.enum('contact_status', ['active', 'archived']);

/**
 * Everyone who touches the business — customers, leads, staff, vendors — is ONE row here.
 * What they *are* is described by tags (tags.ts). What they can *log into* is `auth_user_id`
 * (the auth provider's user id, as TEXT so it fits Supabase uuids and Better-Auth ids alike).
 * What they are *allowed to do* in /admin is `contact_roles` (access.ts).
 */
export const contacts = app
  .table(
    'contacts',
    {
      id: id(),
      firstName: text('first_name'),
      lastName: text('last_name'),
      companyName: text('company_name'),
      /** Always set; derived from the name fields when not given. Used for lists and search. */
      displayName: text('display_name').notNull(),
      /** Lower-cased. Unique when present: one contact per email address. */
      email: text('email'),
      /** E.164 format, e.g. +18165551234. */
      phone: text('phone'),
      /** The auth provider's user id when this contact has a login. */
      authUserId: text('auth_user_id'),
      /** `archived` disables the contact everywhere: login and API keys stop working. */
      status: contactStatus('status').notNull().default('active'),
      /** Where the contact came from: website, admin, api, mcp, import, seed. */
      source: text('source').notNull().default('admin'),
      notes: text('notes'),
      /**
       * Recorded consent to automated texts (notifications module). No consent = nobody is ever
       * texted. `sms_consent_text` is the exact wording they agreed to, `sms_consent_source` where
       * (account, staff, api …). Cleared when they withdraw consent.
       */
      smsConsentAt: timestamp('sms_consent_at', { withTimezone: true }),
      smsConsentSource: text('sms_consent_source'),
      smsConsentText: text('sms_consent_text'),
      createdAt: createdAt(),
      updatedAt: updatedAt(),
    },
    (t) => [
      uniqueIndex('contacts_email_key')
        .on(t.email)
        .where(sql`${t.email} is not null`),
      uniqueIndex('contacts_auth_user_id_key')
        .on(t.authUserId)
        .where(sql`${t.authUserId} is not null`),
      index('contacts_phone_idx').on(t.phone),
      index('contacts_display_name_idx').on(t.displayName),
    ],
  )
  .enableRLS();

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
