import { and, contacts, contactTags, count, desc, eq, exists, ilike, or, tags } from '@app/db';
import { z } from 'zod';

import { defineAction } from '../define';
import { withTagsAndRoles } from './shared';

export const listContacts = defineAction({
  name: 'contacts.list',
  title: 'List contacts',
  description:
    'Search and list contacts (customers, leads, staff, vendors — everyone). ' +
    'Filter by tag slug (e.g. tag="customer") and/or a free-text search over name, email, phone and company. ' +
    'Archived contacts are hidden unless includeArchived is true.',
  audience: 'users.read',
  mutates: false,
  returns: '{ contacts: Contact[] (each with tags, roles, hasLogin), total: number }',
  input: z.object({
    tag: z
      .string()
      .optional()
      .describe('Only contacts with this tag slug, e.g. "customer", "lead", "staff".'),
    search: z
      .string()
      .trim()
      .optional()
      .describe('Matches name, email, phone or company (partial, case-insensitive).'),
    includeArchived: z.boolean().default(false),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().min(0).default(0),
  }),
  async run({ input, tx }) {
    const filters = [];
    if (!input.includeArchived) filters.push(eq(contacts.status, 'active'));
    if (input.search) {
      const q = `%${input.search.replace(/[%_]/g, '\\$&')}%`;
      const digits = input.search.replace(/\D/g, '');
      filters.push(
        or(
          ilike(contacts.displayName, q),
          ilike(contacts.email, q),
          ilike(contacts.companyName, q),
          digits.length >= 3 ? ilike(contacts.phone, `%${digits}%`) : undefined,
        ),
      );
    }
    if (input.tag) {
      filters.push(
        exists(
          tx
            .select({ one: contactTags.contactId })
            .from(contactTags)
            .innerJoin(tags, eq(tags.id, contactTags.tagId))
            .where(and(eq(contactTags.contactId, contacts.id), eq(tags.slug, input.tag))),
        ),
      );
    }
    const where = and(...filters);
    const [rows, [totalRow]] = await Promise.all([
      tx
        .select()
        .from(contacts)
        .where(where)
        .orderBy(desc(contacts.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      tx.select({ value: count() }).from(contacts).where(where),
    ]);
    return { contacts: await withTagsAndRoles(tx, rows), total: totalRow?.value ?? 0 };
  },
});
