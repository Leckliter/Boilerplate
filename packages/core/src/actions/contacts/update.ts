import { contactRoles, contacts, eq } from '@app/db';
import { z } from 'zod';

import { ActionError, defineAction } from '../define';
import {
  assertEmailFree,
  buildDisplayName,
  emailField,
  getContactOrThrow,
  phoneField,
  withTagsAndRoles,
} from './shared';

export const updateContact = defineAction({
  name: 'contacts.update',
  title: 'Update contact',
  description:
    'Change a contact’s details. Only the fields you send are changed; send null to clear a field. ' +
    'To change tags use contacts.addTags / contacts.removeTags. ' +
    'Changing the email of someone who has a login or a staff role needs roles.manage ' +
    '(the email is how a login finds its contact, so it is security-sensitive). ' +
    'Every change is kept in the record history (activity.changes).',
  audience: 'users.manage',
  mutates: true,
  returns: 'The updated Contact',
  input: z.object({
    id: z.uuid(),
    firstName: z.string().trim().min(1).nullable().optional(),
    lastName: z.string().trim().min(1).nullable().optional(),
    companyName: z.string().trim().min(1).nullable().optional(),
    email: emailField.nullable().optional(),
    phone: phoneField.nullable().optional(),
    notes: z.string().trim().nullable().optional(),
  }),
  async run({ input, actor, tx, log }) {
    const { id, ...changes } = input;
    const current = await getContactOrThrow(tx, id);
    if (changes.email !== undefined && changes.email !== current.email) {
      const roles = await tx
        .select()
        .from(contactRoles)
        .where(eq(contactRoles.contactId, id))
        .limit(1);
      if ((current.authUserId || roles.length > 0) && !actor.permissions.has('roles.manage')) {
        throw new ActionError(
          'forbidden',
          'Only someone who manages staff access can change the email of a contact with a login or a role.',
        );
      }
    }
    if (changes.email) await assertEmailFree(tx, changes.email, id);
    const merged = { ...current, ...changes };
    const [row] = await tx
      .update(contacts)
      .set({
        ...changes,
        displayName: buildDisplayName(merged),
      })
      .where(eq(contacts.id, id))
      .returning();
    log({
      subjectType: 'contact',
      subjectId: id,
      summary: `Updated ${row!.displayName}: ${Object.keys(changes).join(', ') || 'no changes'}`,
    });
    const [view] = await withTagsAndRoles(tx, [row!]);
    return view!;
  },
});
