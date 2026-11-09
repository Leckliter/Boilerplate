import { contacts, contactTags, inArray, tags } from '@app/db';
import { z } from 'zod';

import { parseCsv } from '../../csv';
import { emit } from '../../events/emit';
import { ActionError, defineAction } from '../define';
import {
  assertOwnerRemains,
  buildDisplayName,
  emailField,
  phoneField,
  resolveTagIds,
  tagSlugsField,
} from './shared';

const idsField = z.array(z.uuid()).min(1).max(500).describe('Contact ids (at most 500).');

export const bulkAddContactTags = defineAction({
  name: 'contacts.bulkAddTags',
  title: 'Add tags to many contacts',
  description:
    'Add tags to up to 500 contacts at once, all in ONE transaction (all or nothing) and ONE activity-log entry. ' +
    'Contacts that already have a tag keep it. Emits `contact.tagged` for each contact that really got a new tag. ' +
    'An unknown id or tag slug fails the whole call before anything changes.',
  audience: 'users.manage',
  mutates: true,
  returns:
    '{ contacts: number, tagged: number }  (contacts looked at, contacts that got something new)',
  input: z.object({ ids: idsField, tags: tagSlugsField.min(1) }),
  async run({ input, actor, tx, log }) {
    const ids = [...new Set(input.ids)];
    const found = await tx
      .select({ id: contacts.id, displayName: contacts.displayName })
      .from(contacts)
      .where(inArray(contacts.id, ids));
    if (found.length !== ids.length) {
      const missing = ids.filter((id) => !found.some((c) => c.id === id));
      throw new ActionError(
        'not_found',
        `No contact with id ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ' …' : ''}.`,
      );
    }
    const tagIds = await resolveTagIds(tx, input.tags);
    const added = await tx
      .insert(contactTags)
      .values(
        ids.flatMap((contactId) =>
          tagIds.map((tagId) => ({ contactId, tagId, addedBy: actor.contactId })),
        ),
      )
      .onConflictDoNothing()
      .returning({ contactId: contactTags.contactId, tagId: contactTags.tagId });
    const slugOf = new Map(
      (
        await tx.select({ id: tags.id, slug: tags.slug }).from(tags).where(inArray(tags.id, tagIds))
      ).map((t) => [t.id, t.slug]),
    );
    const newSlugs = new Map<string, string[]>();
    for (const a of added) {
      newSlugs.set(a.contactId, [...(newSlugs.get(a.contactId) ?? []), slugOf.get(a.tagId)!]);
    }
    for (const c of found) {
      const slugs = newSlugs.get(c.id);
      if (slugs)
        await emit(tx, 'contact.tagged', {
          contactId: c.id,
          displayName: c.displayName,
          tags: slugs,
        });
    }
    log({
      subjectType: 'contact',
      summary: `Tagged ${newSlugs.size} of ${ids.length} contacts: +${input.tags.join(', +')}`,
    });
    return { contacts: ids.length, tagged: newSlugs.size };
  },
});

export const bulkArchiveContacts = defineAction({
  name: 'contacts.bulkArchive',
  title: 'Archive many contacts',
  description:
    'Archive up to 500 contacts at once in ONE transaction and ONE activity-log entry (their logins and API keys ' +
    'stop working; reversible with contacts.restore). Already archived ones are skipped. Refused (nothing archived) ' +
    'when it would archive the last active owner. Emits `contact.archived` for each.',
  audience: 'users.manage',
  mutates: true,
  destructive: true,
  returns: '{ archived: number, alreadyArchived: number }',
  input: z.object({ ids: idsField }),
  async run({ input, tx, log }) {
    const ids = [...new Set(input.ids)];
    const found = await tx.select().from(contacts).where(inArray(contacts.id, ids));
    if (found.length !== ids.length) {
      const missing = ids.filter((id) => !found.some((c) => c.id === id));
      throw new ActionError(
        'not_found',
        `No contact with id ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ' …' : ''}.`,
      );
    }
    const active = found.filter((c) => c.status === 'active');
    if (active.length) {
      await assertOwnerRemains(
        tx,
        active.map((c) => c.id),
      );
      await tx
        .update(contacts)
        .set({ status: 'archived' })
        .where(
          inArray(
            contacts.id,
            active.map((c) => c.id),
          ),
        );
      for (const c of active)
        await emit(tx, 'contact.archived', { contactId: c.id, displayName: c.displayName });
    }
    log({
      subjectType: 'contact',
      summary: `Archived ${active.length} contact${active.length === 1 ? '' : 's'} in bulk${found.length > active.length ? ` (${found.length - active.length} were already archived)` : ''}`,
    });
    return { archived: active.length, alreadyArchived: found.length - active.length };
  },
});

// ---------------------------------------------------------------- import

/** At most this many data rows per import (split bigger files). */
export const IMPORT_MAX_ROWS = 2_000;
const PROBLEMS_SHOWN = 200;

const ALIASES: Record<
  string,
  'firstName' | 'lastName' | 'companyName' | 'email' | 'phone' | 'notes' | 'tags'
> = {
  first_name: 'firstName',
  firstname: 'firstName',
  first: 'firstName',
  last_name: 'lastName',
  lastname: 'lastName',
  last: 'lastName',
  company: 'companyName',
  company_name: 'companyName',
  organization: 'companyName',
  email: 'email',
  email_address: 'email',
  phone: 'phone',
  mobile: 'phone',
  phone_number: 'phone',
  notes: 'notes',
  tags: 'tags',
};

const rowSchema = z
  .object({
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().min(1).optional(),
    companyName: z.string().trim().min(1).optional(),
    email: emailField.optional(),
    phone: phoneField.optional(),
    notes: z.string().trim().min(1).optional(),
  })
  .refine((v) => v.firstName || v.lastName || v.companyName || v.email || v.phone, {
    message: 'Give at least a name, company, email or phone.',
  });

export const importContacts = defineAction({
  name: 'contacts.import',
  title: 'Import contacts from CSV',
  description:
    `Create contacts from CSV text (a header row, then at most ${IMPORT_MAX_ROWS} rows). Recognised columns: ` +
    'first_name, last_name, company, email, phone, notes, tags (semicolon-separated slugs). Every row is validated; ' +
    'a row whose email already exists (in the system or earlier in the file) is a duplicate and skipped — existing ' +
    'contacts are never changed. Each created contact gets `tags` (the input, plus its own tags column), source ' +
    '"import" and a `contact.created` event. ALWAYS run it first with dryRun=true: nothing is saved, and `problems` ' +
    'lists every row that would be skipped and why. Without dryRun, valid rows are created (one transaction) and ' +
    'bad rows are skipped, not fatal.',
  audience: 'users.manage',
  mutates: true,
  logOnlyWhenChanged: true,
  logInput: (i) => ({ dryRun: i.dryRun, tags: i.tags, csvCharacters: i.csv.length }),
  returns:
    '{ dryRun, total, created, duplicates, invalid, problems: [{ row, status: "duplicate" | "invalid", message }], problemsTruncated }  (row = the row’s number in the file, the header being row 1; blank lines are not counted)',
  input: z.object({
    csv: z.string().min(1).max(2_000_000).describe('The file’s text, header row first.'),
    dryRun: z.boolean().default(false).describe('Check only: save nothing.'),
    tags: tagSlugsField.default([]).describe('Tags added to every created contact.'),
  }),
  async run({ input, actor, tx, log }) {
    const [header, ...body] = parseCsv(input.csv);
    if (!header) throw new ActionError('invalid_input', 'The CSV is empty.');
    const columns = header.map(
      (h) =>
        ALIASES[
          h
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '')
        ],
    );
    if (!columns.some((c) => c && c !== 'tags' && c !== 'notes')) {
      throw new ActionError(
        'invalid_input',
        'No recognised columns. The first row must name them: first_name, last_name, company, email, phone, notes, tags.',
      );
    }
    if (body.length > IMPORT_MAX_ROWS) {
      throw new ActionError(
        'invalid_input',
        `At most ${IMPORT_MAX_ROWS} rows per import (this file has ${body.length}); split it.`,
      );
    }
    const knownTags = new Map(
      (await tx.select({ id: tags.id, slug: tags.slug }).from(tags)).map((t) => [t.slug, t.id]),
    );
    for (const slug of input.tags) {
      if (!knownTags.has(slug))
        throw new ActionError('invalid_input', `Unknown tag: ${slug}. Use tags.list.`);
    }

    type Parsed = { line: number; value: z.output<typeof rowSchema>; tagSlugs: string[] };
    const problems: { row: number; status: 'duplicate' | 'invalid'; message: string }[] = [];
    const valid: Parsed[] = [];
    let invalid = 0;
    for (const [i, cells] of body.entries()) {
      const line = i + 2;
      const raw: Record<string, string> = {};
      let tagCell = '';
      columns.forEach((col, idx) => {
        const v = (cells[idx] ?? '').trim();
        if (!col || !v) return;
        if (col === 'tags') tagCell = v;
        else raw[col] = v;
      });
      const parsed = rowSchema.safeParse(raw);
      const tagSlugs = tagCell
        .split(/[;|]/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const unknown = tagSlugs.filter((t) => !knownTags.has(t));
      if (!parsed.success || unknown.length) {
        invalid++;
        problems.push({
          row: line,
          status: 'invalid',
          message: unknown.length
            ? `Unknown tag(s): ${unknown.join(', ')}`
            : parsed.error!.issues.map((x) => x.message).join('; '),
        });
        continue;
      }
      valid.push({ line, value: parsed.data, tagSlugs });
    }

    const emails = valid.map((v) => v.value.email).filter((e): e is string => Boolean(e));
    const existing = emails.length
      ? new Set(
          (
            await tx
              .select({ email: contacts.email })
              .from(contacts)
              .where(inArray(contacts.email, emails))
          ).map((c) => c.email),
        )
      : new Set<string | null>();
    const seen = new Set<string>();
    const toCreate: Parsed[] = [];
    let duplicates = 0;
    for (const v of valid) {
      const email = v.value.email;
      if (email && (existing.has(email) || seen.has(email))) {
        duplicates++;
        problems.push({
          row: v.line,
          status: 'duplicate',
          message: existing.has(email)
            ? `${email} already exists.`
            : `${email} appears earlier in the file.`,
        });
        continue;
      }
      if (email) seen.add(email);
      toCreate.push(v);
    }

    if (!input.dryRun) {
      for (const v of toCreate) {
        const slugs = [...new Set([...input.tags, ...v.tagSlugs])];
        const [row] = await tx
          .insert(contacts)
          .values({ ...v.value, displayName: buildDisplayName(v.value), source: 'import' })
          .returning();
        if (slugs.length) {
          await tx.insert(contactTags).values(
            slugs.map((s) => ({
              contactId: row!.id,
              tagId: knownTags.get(s)!,
              addedBy: actor.contactId,
            })),
          );
        }
        await emit(tx, 'contact.created', {
          contactId: row!.id,
          displayName: row!.displayName,
          email: row!.email,
          phone: row!.phone,
          tags: slugs,
        });
      }
      if (toCreate.length) {
        log({
          subjectType: 'contact',
          summary: `Imported ${toCreate.length} contact${toCreate.length === 1 ? '' : 's'} from CSV (${duplicates} duplicates, ${invalid} invalid skipped)`,
        });
      }
    }
    problems.sort((a, b) => a.row - b.row);
    return {
      dryRun: input.dryRun,
      total: body.length,
      created: toCreate.length,
      duplicates,
      invalid,
      problems: problems.slice(0, PROBLEMS_SHOWN),
      problemsTruncated: problems.length > PROBLEMS_SHOWN,
    };
  },
});
