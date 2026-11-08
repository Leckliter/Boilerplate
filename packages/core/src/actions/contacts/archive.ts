import { and, contactRoles, contacts, eq, inArray } from '@app/db';
import { z } from 'zod';

import { ActionError, defineAction } from '../define';
import { getContactOrThrow } from './shared';

export const archiveContact = defineAction({
  name: 'contacts.archive',
  title: 'Archive contact',
  description:
    'Disable a contact and hide them from lists without deleting their history: their login and API keys ' +
    'stop working everywhere. Reversible with contacts.restore. Contacts are never hard-deleted through actions. ' +
    'The last owner cannot be archived.',
  audience: 'users.manage',
  mutates: true,
  destructive: true,
  returns: '{ id, status }',
  input: z.object({ id: z.uuid() }),
  async run({ input, tx, log }) {
    const c = await getContactOrThrow(tx, input.id);
    // Lock every owner row so two simultaneous archives can't both pass the check.
    const owners = await tx
      .select({ contactId: contactRoles.contactId })
      .from(contactRoles)
      .where(eq(contactRoles.role, 'owner'))
      .for('update');
    const active = owners.length
      ? await tx
          .select({ id: contacts.id })
          .from(contacts)
          .where(
            and(
              inArray(
                contacts.id,
                owners.map((o) => o.contactId),
              ),
              eq(contacts.status, 'active'),
            ),
          )
      : [];
    if (active.some((o) => o.id === c.id) && active.length <= 1) {
      throw new ActionError('conflict', 'This is the last owner; add another owner first.');
    }
    await tx.update(contacts).set({ status: 'archived' }).where(eq(contacts.id, input.id));
    log({ subjectType: 'contact', subjectId: c.id, summary: `Archived ${c.displayName}` });
    return { id: c.id, status: 'archived' as const };
  },
});

export const restoreContact = defineAction({
  name: 'contacts.restore',
  title: 'Restore contact',
  description:
    'Un-archive a contact: they show in lists again and their login and API keys work again.',
  audience: 'users.manage',
  mutates: true,
  returns: '{ id, status }',
  input: z.object({ id: z.uuid() }),
  async run({ input, tx, log }) {
    const c = await getContactOrThrow(tx, input.id);
    await tx.update(contacts).set({ status: 'active' }).where(eq(contacts.id, input.id));
    log({ subjectType: 'contact', subjectId: c.id, summary: `Restored ${c.displayName}` });
    return { id: c.id, status: 'active' as const };
  },
});
