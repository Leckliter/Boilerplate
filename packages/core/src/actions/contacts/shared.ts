import {
  type Contact,
  contactRoles,
  contacts,
  contactTags,
  eq,
  inArray,
  tags,
  type Tx,
} from '@app/db';
import { z } from 'zod';

import { ActionError } from '../define';

// ---------- input fields shared by contact actions ----------

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email())
  .describe('Email address. Stored lower-case; must be unique across contacts.');

export const phoneField = z
  .string()
  .transform((v, ctx) => {
    const e164 = toE164(v);
    if (!e164) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid phone number, e.g. (816) 555-1234.' });
      return z.NEVER;
    }
    return e164;
  })
  .describe('Phone number in any common format; stored as E.164 (+18165551234). US is assumed.');

export const tagSlugsField = z
  .array(z.string().min(1))
  .describe('Tag slugs, e.g. ["customer"] or ["staff","customer"]. Use tags.list to see them.');

/** US-default phone normalizer: (816) 555-1234 → +18165551234. Change the default for other countries. */
export function toE164(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+'))
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

export function buildDisplayName(c: {
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
}): string {
  const person = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  return person || c.companyName || c.email || c.phone || 'Unnamed contact';
}

// ---------- reads ----------

export type ContactTag = { slug: string; label: string; kind: 'type' | 'label'; color: string };

export type ContactView = Contact & { tags: ContactTag[]; roles: string[]; hasLogin: boolean };

/** Attach tags and roles to a list of contacts (two queries, no N+1). */
export async function withTagsAndRoles(tx: Tx, rows: Contact[]): Promise<ContactView[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [tagRows, roleRows] = await Promise.all([
    tx
      .select({
        contactId: contactTags.contactId,
        slug: tags.slug,
        label: tags.label,
        kind: tags.kind,
        color: tags.color,
        sortOrder: tags.sortOrder,
      })
      .from(contactTags)
      .innerJoin(tags, eq(tags.id, contactTags.tagId))
      .where(inArray(contactTags.contactId, ids)),
    tx.select().from(contactRoles).where(inArray(contactRoles.contactId, ids)),
  ]);
  return rows.map((r) => ({
    ...r,
    tags: tagRows
      .filter((t) => t.contactId === r.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ slug, label, kind, color }) => ({ slug, label, kind, color })),
    roles: roleRows.filter((x) => x.contactId === r.id).map((x) => x.role),
    hasLogin: r.authUserId !== null,
  }));
}

export async function getContactOrThrow(tx: Tx, id: string): Promise<Contact> {
  const [row] = await tx.select().from(contacts).where(eq(contacts.id, id));
  if (!row) throw new ActionError('not_found', `No contact with id ${id}.`);
  return row;
}

/** Resolve tag slugs to ids, failing loudly on unknown slugs so typos never vanish silently. */
export async function resolveTagIds(tx: Tx, slugs: readonly string[]): Promise<string[]> {
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return [];
  const found = await tx
    .select({ id: tags.id, slug: tags.slug })
    .from(tags)
    .where(inArray(tags.slug, unique));
  const missing = unique.filter((s) => !found.some((f) => f.slug === s));
  if (missing.length) {
    throw new ActionError(
      'invalid_input',
      `Unknown tag(s): ${missing.join(', ')}. Use tags.list to see valid tags.`,
    );
  }
  return found.map((f) => f.id);
}

export async function assertEmailFree(tx: Tx, email: string, exceptId?: string) {
  const [existing] = await tx
    .select({ id: contacts.id, displayName: contacts.displayName })
    .from(contacts)
    .where(eq(contacts.email, email));
  if (existing && existing.id !== exceptId) {
    throw new ActionError('conflict', `${email} already belongs to ${existing.displayName}.`, {
      existingContactId: existing.id,
    });
  }
}
