import { and, contacts, contactTags, desc, eq, exists, ilike, inArray, or, tags } from '@app/db';
import { z } from 'zod';

import { toCsv } from '../../csv';
import { defineAction } from '../define';

/** More than this many rows is cut off (`truncated: true`): export a tag or a search at a time. */
export const CONTACT_EXPORT_MAX_ROWS = 10_000;

export const exportContactsCsv = defineAction({
  name: 'contacts.exportCsv',
  title: 'Export contacts as CSV',
  description:
    'Personal data, so it needs `data.export` and is written to the activity log. Returns the contacts (filter by ' +
    'tag slug and/or search; archived are left out unless asked) as CSV text — columns id, first_name, last_name, ' +
    'company, email, phone, tags (semicolon-separated), status, source, sms_consent, notes, created_at — in `csv`, ' +
    `with the suggested \`filename\`. At most ${CONTACT_EXPORT_MAX_ROWS.toLocaleString('en-US')} rows (\`truncated\` ` +
    'says when more matched). The same columns are what contacts.import reads back.',
  audience: 'data.export',
  // Not a data change, but handing out everyone's personal data deserves an audit row (and, for AI
  // clients, a confirmation: mutating tools are not marked read-only).
  mutates: true,
  returns: '{ filename, contentType: "text/csv", csv, rows, truncated }',
  input: z.object({
    tag: z.string().optional().describe('Only contacts with this tag slug.'),
    search: z.string().trim().optional().describe('Matches name, email, phone or company.'),
    includeArchived: z.boolean().default(false),
  }),
  async run({ input, tx, log }) {
    const filters = [];
    if (!input.includeArchived) filters.push(eq(contacts.status, 'active'));
    if (input.search) {
      const q = `%${input.search.replace(/[\\%_]/g, '\\$&')}%`;
      filters.push(
        or(
          ilike(contacts.displayName, q),
          ilike(contacts.email, q),
          ilike(contacts.companyName, q),
          ilike(contacts.phone, q),
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
    const found = await tx
      .select()
      .from(contacts)
      .where(and(...filters))
      .orderBy(desc(contacts.createdAt))
      .limit(CONTACT_EXPORT_MAX_ROWS + 1);
    const truncated = found.length > CONTACT_EXPORT_MAX_ROWS;
    const rows = truncated ? found.slice(0, CONTACT_EXPORT_MAX_ROWS) : found;
    const tagRows = rows.length
      ? await tx
          .select({ contactId: contactTags.contactId, slug: tags.slug })
          .from(contactTags)
          .innerJoin(tags, eq(tags.id, contactTags.tagId))
          .where(
            inArray(
              contactTags.contactId,
              rows.map((r) => r.id),
            ),
          )
      : [];
    const tagsOf = new Map<string, string[]>();
    for (const t of tagRows) tagsOf.set(t.contactId, [...(tagsOf.get(t.contactId) ?? []), t.slug]);
    const csv = toCsv(
      [
        'id',
        'first_name',
        'last_name',
        'company',
        'email',
        'phone',
        'tags',
        'status',
        'source',
        'sms_consent',
        'notes',
        'created_at',
      ],
      rows.map((c) => [
        c.id,
        c.firstName,
        c.lastName,
        c.companyName,
        c.email,
        c.phone,
        (tagsOf.get(c.id) ?? []).sort().join(';'),
        c.status,
        c.source,
        c.smsConsentAt ? 'yes' : 'no',
        c.notes,
        c.createdAt,
      ]),
    );
    log({
      subjectType: 'contact',
      summary: `Exported ${rows.length} contact${rows.length === 1 ? '' : 's'} as CSV${input.tag ? ` (tag ${input.tag})` : ''}${truncated ? ' (cut off)' : ''}`,
    });
    return {
      filename: `contacts-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: 'text/csv' as const,
      csv,
      rows: rows.length,
      truncated,
    };
  },
});
