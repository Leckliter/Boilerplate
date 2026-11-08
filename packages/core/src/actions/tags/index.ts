import { asc, contactTags, count, eq, tags } from '@app/db';
import { z } from 'zod';

import { ActionError, defineAction } from '../define';

const TAG_COLORS = ['neutral', 'brand', 'blue', 'green', 'amber', 'red', 'purple', 'teal'] as const;

export const listTags = defineAction({
  name: 'tags.list',
  title: 'List tags',
  description:
    'All tags with how many contacts carry each. kind="type" tags (customer, lead, staff, vendor) ' +
    'are the main contact categories; kind="label" tags are extra descriptors.',
  audience: 'users.read',
  mutates: false,
  returns: 'Tag[] with contactCount',
  input: z.object({}),
  async run({ tx }) {
    return tx
      .select({
        id: tags.id,
        slug: tags.slug,
        label: tags.label,
        kind: tags.kind,
        color: tags.color,
        description: tags.description,
        system: tags.system,
        sortOrder: tags.sortOrder,
        contactCount: count(contactTags.contactId),
      })
      .from(tags)
      .leftJoin(contactTags, eq(contactTags.tagId, tags.id))
      .groupBy(tags.id)
      .orderBy(asc(tags.sortOrder), asc(tags.label));
  },
});

export const createTag = defineAction({
  name: 'tags.create',
  title: 'Create tag',
  description:
    'Create a new tag. Use kind="type" only for a new top-level contact category (it appears in the admin Contacts menu); otherwise kind="label".',
  audience: 'users.manage',
  mutates: true,
  returns: 'The new Tag',
  input: z.object({
    slug: z
      .string()
      .regex(/^[a-z][a-z0-9-]{1,40}$/, 'lowercase letters, numbers and dashes')
      .describe('Machine name, e.g. "net-30". Permanent.'),
    label: z.string().trim().min(1).max(60),
    kind: z.enum(['type', 'label']).default('label'),
    color: z.enum(TAG_COLORS).default('neutral'),
    description: z.string().trim().max(300).optional(),
  }),
  async run({ input, tx, log }) {
    const [exists] = await tx.select({ id: tags.id }).from(tags).where(eq(tags.slug, input.slug));
    if (exists)
      throw new ActionError('conflict', `A tag with slug "${input.slug}" already exists.`);
    const [row] = await tx.insert(tags).values(input).returning();
    log({ subjectType: 'tag', subjectId: row!.id, summary: `Created tag ${row!.label}` });
    return row!;
  },
});

export const deleteTag = defineAction({
  name: 'tags.delete',
  title: 'Delete tag',
  description:
    'Delete a non-system tag and remove it from every contact. System tags (customer, lead, …) cannot be deleted.',
  audience: 'users.manage',
  mutates: true,
  destructive: true,
  returns: '{ slug }',
  input: z.object({ slug: z.string() }),
  async run({ input, tx, log }) {
    const [tag] = await tx.select().from(tags).where(eq(tags.slug, input.slug));
    if (!tag) throw new ActionError('not_found', `No tag "${input.slug}".`);
    if (tag.system)
      throw new ActionError('forbidden', `"${tag.label}" is a system tag and can't be deleted.`);
    await tx.delete(tags).where(eq(tags.id, tag.id));
    log({ subjectType: 'tag', subjectId: tag.id, summary: `Deleted tag ${tag.label}` });
    return { slug: tag.slug };
  },
});
