import { z } from 'zod';

import { defineAction } from '../define';
import { getContactOrThrow, withTagsAndRoles } from './shared';

export const getContact = defineAction({
  name: 'contacts.get',
  title: 'Get contact',
  description:
    'Fetch one contact by id, including tags, staff roles and whether they have a login.',
  audience: 'users.read',
  mutates: false,
  returns: 'Contact (with tags, roles, hasLogin)',
  input: z.object({ id: z.uuid().describe('Contact id.') }),
  async run({ input, tx }) {
    const [view] = await withTagsAndRoles(tx, [await getContactOrThrow(tx, input.id)]);
    return view!;
  },
});
