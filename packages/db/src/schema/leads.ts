import { index, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { contacts } from './contacts';
import { app, createdAt, id, updatedAt } from './_shared';

/**
 * Website leads: contact-form inquiries and newsletter sign-ups. Both link to a contact (the
 * person is always a contact; tags say they are a `lead`). See docs/actions.md → inquiries.*.
 */
export const inquiryStatus = app.enum('inquiry_status', [
  'new', // just arrived, nobody has looked yet
  'in_progress', // somebody is on it
  'resolved', // answered / dealt with
  'spam', // not a real inquiry
  'archived', // hidden from the default list
]);

export const inquiries = app
  .table(
    'inquiries',
    {
      id: id(),
      /** The lead contact this was matched to or created for (by email). */
      contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
      /** What the visitor typed (kept as typed, even if the contact is renamed later). */
      name: text('name').notNull(),
      email: text('email').notNull(),
      phone: text('phone'),
      subject: text('subject'),
      message: text('message').notNull(),
      status: inquiryStatus('status').notNull().default('new'),
      /** Internal note by staff — never shown to the visitor. */
      staffNote: text('staff_note'),
      /** Where the form lives: website, pricing-page … */
      source: text('source').notNull().default('website'),
      handledByContactId: uuid('handled_by_contact_id').references(() => contacts.id, {
        onDelete: 'set null',
      }),
      createdAt: createdAt(),
      updatedAt: updatedAt(),
    },
    (t) => [
      index('inquiries_status_idx').on(t.status, t.createdAt),
      index('inquiries_contact_idx').on(t.contactId),
    ],
  )
  .enableRLS();

export const newsletterStatus = app.enum('newsletter_status', [
  'pending', // asked to subscribe; waiting for the confirmation click (double opt-in)
  'subscribed',
  'unsubscribed',
]);

/**
 * One row per email address on the newsletter, with the consent record (what they agreed to,
 * when, through which door). Nobody is `subscribed` without clicking the confirmation link.
 */
export const newsletterSubscriptions = app
  .table(
    'newsletter_subscriptions',
    {
      id: id(),
      /** Lower-cased. */
      email: text('email').notNull(),
      contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
      status: newsletterStatus('status').notNull().default('pending'),
      /** The exact wording they agreed to, where (website, account, import …) and when. */
      consentText: text('consent_text'),
      consentSource: text('consent_source'),
      consentAt: timestamp('consent_at', { withTimezone: true }),
      confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
      unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
      createdAt: createdAt(),
      updatedAt: updatedAt(),
    },
    (t) => [uniqueIndex('newsletter_subscriptions_email_key').on(t.email)],
  )
  .enableRLS();

export type Inquiry = typeof inquiries.$inferSelect;
export type NewsletterSubscription = typeof newsletterSubscriptions.$inferSelect;
