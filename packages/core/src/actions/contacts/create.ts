import { contacts, contactTags } from '@app/db';
import { z } from 'zod';

import { defineAction } from '../define';
import {
  assertEmailFree,
  buildDisplayName,
  emailField,
  phoneField,
  resolveTagIds,
  tagSlugsField,
  withTagsAndRoles,
} from './shared';

export const createContact = defineAction({
  name: 'contacts.create',
  title: 'Create contact',
  description:
    'Create a contact — anyone the business deals with. Say what they are with tags: ' +
    'e.g. tags=["lead"] for a new lead, ["customer"], ["staff","customer"] for an employee who is also a customer, ["vendor"]. ' +
    'Tags only describe the person; they do NOT grant app access (use access.grantRole for that). ' +
    'Fails with "conflict" if the email already exists — use contacts.list to find that contact instead.',
  audience: 'users.manage',
  mutates: true,
  returns: 'The new Contact (with tags, roles, hasLogin)',
  input: z
    .object({
      firstName: z.string().trim().min(1).optional(),
      lastName: z.string().trim().min(1).optional(),
      companyName: z.string().trim().min(1).optional(),
      email: emailField.optional(),
      phone: phoneField.optional(),
      notes: z.string().trim().optional(),
      tags: tagSlugsField.default([]),
    })
    .refine((v) => v.firstName || v.lastName || v.companyName || v.email || v.phone, {
      message: 'Give at least a name, company, email or phone.',
    }),
  async run({ input, actor, tx, log }) {
    if (input.email) await assertEmailFree(tx, input.email);
    const tagIds = await resolveTagIds(tx, input.tags);
    const [row] = await tx
      .insert(contacts)
      .values({
        firstName: input.firstName,
        lastName: input.lastName,
        companyName: input.companyName,
        displayName: buildDisplayName(input),
        email: input.email,
        phone: input.phone,
        notes: input.notes,
        source: actor.channel === 'web' ? 'admin' : actor.channel,
      })
      .returning();
    if (tagIds.length) {
      await tx
        .insert(contactTags)
        .values(tagIds.map((tagId) => ({ contactId: row!.id, tagId, addedBy: actor.contactId })));
    }
    log({ subjectType: 'contact', subjectId: row!.id, summary: `Created ${row!.displayName}` });
    const [view] = await withTagsAndRoles(tx, [row!]);
    return view!;
  },
});
