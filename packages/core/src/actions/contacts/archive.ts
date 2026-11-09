import { contacts, eq } from '@app/db';
import { z } from 'zod';

import { defineAction } from '../define';
import { emit } from '../../events/emit';
import { assertOwnerRemains, getContactOrThrow } from './shared';

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
    await assertOwnerRemains(tx, [c.id]);
    await tx.update(contacts).set({ status: 'archived' }).where(eq(contacts.id, input.id));
    await emit(tx, 'contact.archived', { contactId: c.id, displayName: c.displayName });
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
