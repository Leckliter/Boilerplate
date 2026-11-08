import { and, contactTags, eq, inArray, tags } from '@app/db';
import { z } from 'zod';

import { defineAction } from '../define';
import { emit } from '../../events/emit';
import { getContactOrThrow, resolveTagIds, tagSlugsField, withTagsAndRoles } from './shared';

export const addContactTags = defineAction({
  name: 'contacts.addTags',
  title: 'Add tags to contact',
  description:
    'Add one or more tags to a contact, e.g. tags=["customer"] when a lead buys for the first time. ' +
    'Adding a tag the contact already has is a no-op. Tags never grant app access.',
  audience: 'users.manage',
  mutates: true,
  returns: 'The updated Contact',
  input: z.object({ id: z.uuid(), tags: tagSlugsField.min(1) }),
  async run({ input, actor, tx, log }) {
    const c = await getContactOrThrow(tx, input.id);
    const tagIds = await resolveTagIds(tx, input.tags);
    const added = await tx
      .insert(contactTags)
      .values(tagIds.map((tagId) => ({ contactId: c.id, tagId, addedBy: actor.contactId })))
      .onConflictDoNothing()
      .returning({ tagId: contactTags.tagId });
    if (added.length) {
      // Only the tags that were really new (adding one they already have is a no-op).
      const newSlugs = (
        await tx
          .select({ slug: tags.slug })
          .from(tags)
          .where(
            inArray(
              tags.id,
              added.map((r) => r.tagId),
            ),
          )
      ).map((t) => t.slug);
      await emit(tx, 'contact.tagged', {
        contactId: c.id,
        displayName: c.displayName,
        tags: newSlugs,
      });
    }
    log({
      subjectType: 'contact',
      subjectId: c.id,
      summary: `Tagged ${c.displayName}: +${input.tags.join(', +')}`,
    });
    const [view] = await withTagsAndRoles(tx, [c]);
    return view!;
  },
});

export const removeContactTags = defineAction({
  name: 'contacts.removeTags',
  title: 'Remove tags from contact',
  description: 'Remove one or more tags from a contact. Removing a tag they don’t have is a no-op.',
  audience: 'users.manage',
  mutates: true,
  destructive: true,
  returns: 'The updated Contact',
  input: z.object({ id: z.uuid(), tags: tagSlugsField.min(1) }),
  async run({ input, tx, log }) {
    const c = await getContactOrThrow(tx, input.id);
    const tagIds = await resolveTagIds(tx, input.tags);
    await tx
      .delete(contactTags)
      .where(and(eq(contactTags.contactId, c.id), inArray(contactTags.tagId, tagIds)));
    log({
      subjectType: 'contact',
      subjectId: c.id,
      summary: `Untagged ${c.displayName}: -${input.tags.join(', -')}`,
    });
    const [view] = await withTagsAndRoles(tx, [c]);
    return view!;
  },
});
