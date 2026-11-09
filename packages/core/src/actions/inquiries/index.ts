// ---------------------------------------------------------------- inquiries
/** The website contact form (public) and the staff inbox for it (docs/actions.md). */

import { and, contacts, count, desc, eq, ilike, inquiries, ne, or, type Tx } from '@app/db';
import { z } from 'zod';

import { emit } from '../../events/emit';
import { notify } from '../../notifications/notify';
import { ActionError, defineAction } from '../define';
import { findOrCreateLead } from '../contacts/lead';
import { emailField, phoneField, withTagsAndRoles } from '../contacts/shared';

const STATUSES = ['new', 'in_progress', 'resolved', 'spam', 'archived'] as const;
const statusField = z.enum(STATUSES);

export const createInquiry = defineAction({
  name: 'inquiries.create',
  title: 'Send an inquiry',
  description:
    'Public: the website’s contact form. Stores the message, links it to the contact with that email (creating a ' +
    '`lead` contact when there is none — an existing customer is linked, not re-tagged), emits `inquiry.created` ' +
    'and tells staff with inquiries.manage. Always answers `{ received: true }`. `website` is a honeypot for bots: ' +
    'real forms leave it empty (hide it with CSS); anything in it is silently dropped. Rate-limited and bot-checked.',
  audience: 'public',
  mutates: true,
  logOnlyWhenChanged: true,
  rateLimit: { limit: 5, perSeconds: 60 * 60 },
  humanCheck: true,
  returns: '{ received: true }',
  input: z.object({
    name: z.string().trim().min(1).max(120),
    email: emailField,
    phone: phoneField.optional(),
    subject: z.string().trim().max(200).optional(),
    message: z.string().trim().min(5, 'Please write a few words.').max(5_000),
    source: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .default('website')
      .describe('Which form, e.g. "pricing".'),
    website: z.string().max(500).optional().describe('Honeypot — leave empty.'),
  }),
  async run({ input, tx, log }) {
    // Bots fill every field. Say thanks, store nothing.
    if (input.website?.trim()) return { received: true as const };
    const { contact, created } = await findOrCreateLead(tx, {
      email: input.email,
      name: input.name,
      phone: input.phone,
      source: input.source,
    });
    const [row] = await tx
      .insert(inquiries)
      .values({
        contactId: contact.id,
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        subject: input.subject || null,
        message: input.message,
        source: input.source,
      })
      .returning({ id: inquiries.id });
    await emit(tx, 'inquiry.created', {
      inquiryId: row!.id,
      contactId: contact.id,
      name: input.name,
      email: input.email,
      subject: input.subject || null,
      newContact: created,
    });
    await notify(tx, 'staff.newInquiry', {
      to: { permission: 'inquiries.manage' },
      data: {
        inquiryId: row!.id,
        name: input.name,
        email: input.email,
        subject: input.subject || null,
        preview: input.message.slice(0, 160),
      },
      subject: { type: 'inquiry', id: row!.id },
      dedupeKey: row!.id,
    });
    log({
      subjectType: 'contact',
      subjectId: contact.id,
      summary: `Website inquiry from ${input.name}${created ? ' (new lead)' : ''}`,
    });
    return { received: true as const };
  },
});

const columns = {
  id: inquiries.id,
  contactId: inquiries.contactId,
  name: inquiries.name,
  email: inquiries.email,
  phone: inquiries.phone,
  subject: inquiries.subject,
  message: inquiries.message,
  status: inquiries.status,
  staffNote: inquiries.staffNote,
  source: inquiries.source,
  handledByContactId: inquiries.handledByContactId,
  createdAt: inquiries.createdAt,
  updatedAt: inquiries.updatedAt,
};

export const listInquiries = defineAction({
  name: 'inquiries.list',
  title: 'List inquiries',
  description:
    'Website inquiries, newest first, with how many there are per status. Without `status` the list shows new, ' +
    'in-progress and resolved ones (spam and archived are hidden). Search `q` matches name, email, subject and message.',
  audience: 'inquiries.manage',
  mutates: false,
  returns:
    '{ inquiries: [{ id, contactId, name, email, phone, subject, message, status, staffNote, source, createdAt, … }], total, counts: { new, in_progress, resolved, spam, archived } }',
  input: z.object({
    status: statusField.optional(),
    q: z.string().trim().min(1).max(100).optional(),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().min(0).default(0),
  }),
  async run({ input, tx }) {
    const like = input.q ? `%${input.q.replace(/[%_]/g, '\\$&')}%` : null;
    const where = and(
      input.status
        ? eq(inquiries.status, input.status)
        : and(ne(inquiries.status, 'archived'), ne(inquiries.status, 'spam')),
      like
        ? or(
            ilike(inquiries.name, like),
            ilike(inquiries.email, like),
            ilike(inquiries.subject, like),
            ilike(inquiries.message, like),
          )
        : undefined,
    );
    const [rows, [total], perStatus] = await Promise.all([
      tx
        .select(columns)
        .from(inquiries)
        .where(where)
        .orderBy(desc(inquiries.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      tx.select({ value: count() }).from(inquiries).where(where),
      tx.select({ status: inquiries.status, n: count() }).from(inquiries).groupBy(inquiries.status),
    ]);
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<
      (typeof STATUSES)[number],
      number
    >;
    for (const r of perStatus) counts[r.status] = r.n;
    return { inquiries: rows, total: total?.value ?? 0, counts };
  },
});

async function inquiryOrThrow(tx: Tx, id: string) {
  const [row] = await tx.select(columns).from(inquiries).where(eq(inquiries.id, id));
  if (!row) throw new ActionError('not_found', 'No such inquiry.');
  return row;
}

export const getInquiry = defineAction({
  name: 'inquiries.get',
  title: 'Get an inquiry',
  description: 'One inquiry with the contact it belongs to (with their tags) and who handled it.',
  audience: 'inquiries.manage',
  mutates: false,
  returns: '{ …inquiry, contact: Contact | null, handledByName }',
  input: z.object({ id: z.uuid() }),
  async run({ input, tx }) {
    const row = await inquiryOrThrow(tx, input.id);
    const [c] = row.contactId
      ? await tx.select().from(contacts).where(eq(contacts.id, row.contactId))
      : [];
    const [h] = row.handledByContactId
      ? await tx
          .select({ name: contacts.displayName })
          .from(contacts)
          .where(eq(contacts.id, row.handledByContactId))
      : [];
    const [contact] = c ? await withTagsAndRoles(tx, [c]) : [];
    return { ...row, contact: contact ?? null, handledByName: h?.name ?? null };
  },
});

export const updateInquiry = defineAction({
  name: 'inquiries.update',
  title: 'Update an inquiry',
  description:
    'Change an inquiry’s `status` (new, in_progress, resolved, spam, archived) and/or replace the internal staff ' +
    '`note` (never shown to the visitor; null clears it). The first status change records who is handling it.',
  audience: 'inquiries.manage',
  mutates: true,
  returns: 'The updated inquiry',
  input: z
    .object({
      id: z.uuid(),
      status: statusField.optional(),
      note: z.string().trim().max(5_000).nullable().optional(),
    })
    .refine(
      (v) => v.status !== undefined || v.note !== undefined,
      'Change the status or the note.',
    ),
  async run({ input, actor, tx, log }) {
    const current = await inquiryOrThrow(tx, input.id);
    const [row] = await tx
      .update(inquiries)
      .set({
        ...(input.status !== undefined && { status: input.status }),
        ...(input.note !== undefined && { staffNote: input.note || null }),
        ...(input.status !== undefined &&
          input.status !== current.status && { handledByContactId: actor.contactId }),
      })
      .where(eq(inquiries.id, input.id))
      .returning(columns);
    log({
      subjectType: 'contact',
      subjectId: current.contactId ?? undefined,
      summary: `Inquiry from ${current.name}: ${
        [
          input.status && input.status !== current.status
            ? `${current.status} → ${input.status}`
            : null,
          input.note !== undefined ? 'note changed' : null,
        ]
          .filter(Boolean)
          .join(', ') || 'no changes'
      }`,
    });
    return row!;
  },
});

export const archiveInquiry = defineAction({
  name: 'inquiries.archive',
  title: 'Archive an inquiry',
  description:
    'Hide an inquiry from the default list (status "archived"). Nothing is deleted; set another status with ' +
    'inquiries.update to bring it back.',
  audience: 'inquiries.manage',
  mutates: true,
  destructive: true,
  returns: '{ id, status }',
  input: z.object({ id: z.uuid() }),
  async run({ input, actor, tx, log }) {
    const current = await inquiryOrThrow(tx, input.id);
    await tx
      .update(inquiries)
      .set({
        status: 'archived',
        ...(current.status !== 'archived' && { handledByContactId: actor.contactId }),
      })
      .where(eq(inquiries.id, input.id));
    log({
      subjectType: 'contact',
      subjectId: current.contactId ?? undefined,
      summary: `Archived the inquiry from ${current.name}`,
    });
    return { id: input.id, status: 'archived' as const };
  },
});
