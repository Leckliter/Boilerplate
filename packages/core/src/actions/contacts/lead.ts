import { type Contact, contacts, contactTags, eq, type Tx } from '@app/db';

import { emit } from '../../events/emit';
import { buildDisplayName, resolveTagIds } from './shared';

/** "Pat Q. Example" → { firstName: "Pat", lastName: "Q. Example" }; one word = first name only. */
export function splitName(name: string): { firstName: string; lastName: string | null } {
  const [first = '', ...rest] = name.trim().split(/\s+/);
  return { firstName: first, lastName: rest.length ? rest.join(' ') : null };
}

/**
 * The contact for someone who reached out through a public form: the one with that email, or a
 * new one tagged `lead` (source = where the form lives). One person = one contact: an existing
 * customer or staff member is linked, never duplicated and never re-tagged. Emits
 * `contact.created` for a new one, like contacts.create. Public actions only.
 */
export async function findOrCreateLead(
  tx: Tx,
  input: { email: string; name?: string; phone?: string; source: string },
): Promise<{ contact: Contact; created: boolean }> {
  const [existing] = await tx.select().from(contacts).where(eq(contacts.email, input.email));
  if (existing) return { contact: existing, created: false };
  const name = input.name ? splitName(input.name) : { firstName: null, lastName: null };
  const [row] = await tx
    .insert(contacts)
    .values({
      firstName: name.firstName || null,
      lastName: name.lastName,
      displayName: buildDisplayName({ ...name, email: input.email }),
      email: input.email,
      phone: input.phone ?? null,
      source: input.source,
    })
    .returning();
  const [leadTag] = await resolveTagIds(tx, ['lead']);
  await tx.insert(contactTags).values({ contactId: row!.id, tagId: leadTag! });
  await emit(tx, 'contact.created', {
    contactId: row!.id,
    displayName: row!.displayName,
    email: row!.email,
    phone: row!.phone,
    tags: ['lead'],
  });
  return { contact: row!, created: true };
}
