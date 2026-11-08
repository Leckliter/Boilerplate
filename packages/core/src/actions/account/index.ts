import { contacts, eq } from '@app/db';
import { z } from 'zod';

import { ActionError, defineAction } from '../define';
import {
  buildDisplayName,
  getContactOrThrow,
  phoneField,
  withTagsAndRoles,
} from '../contacts/shared';

export const getMyAccount = defineAction({
  name: 'account.get',
  title: 'My account',
  description: 'The signed-in person’s own contact record (name, email, phone, tags, roles).',
  audience: 'authenticated',
  mutates: false,
  returns: 'Contact (with tags, roles, hasLogin)',
  input: z.object({}),
  async run({ actor, tx }) {
    if (!actor.contactId) throw new ActionError('not_found', 'The system has no account.');
    const [view] = await withTagsAndRoles(tx, [await getContactOrThrow(tx, actor.contactId)]);
    return view!;
  },
});

export const updateMyAccount = defineAction({
  name: 'account.update',
  title: 'Update my account',
  description:
    'Change your own name and phone. Your email is the key your login is linked by, so it changes only through ' +
    'the sign-in provider (the new address is copied here when you confirm it).',
  audience: 'authenticated',
  mutates: true,
  returns: 'The updated Contact',
  input: z.object({
    firstName: z.string().trim().min(1).nullable().optional(),
    lastName: z.string().trim().min(1).nullable().optional(),
    phone: phoneField.nullable().optional(),
  }),
  async run({ input, actor, tx, log }) {
    if (!actor.contactId) throw new ActionError('forbidden', 'Only people have an account.');
    const current = await getContactOrThrow(tx, actor.contactId);
    const [row] = await tx
      .update(contacts)
      .set({ ...input, displayName: buildDisplayName({ ...current, ...input }) })
      .where(eq(contacts.id, current.id))
      .returning();
    log({
      subjectType: 'contact',
      subjectId: current.id,
      summary: `${row!.displayName} updated their own details: ${Object.keys(input).join(', ') || 'no changes'}`,
    });
    const [view] = await withTagsAndRoles(tx, [row!]);
    return view!;
  },
});
