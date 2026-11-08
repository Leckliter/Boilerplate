/**
 * Demo data for development: an owner, a few staff and customers, a lead.
 *
 *   pnpm db:seed
 *
 * Refuses to run against production. Safe to run twice (it skips what exists). The owner's
 * email is the first entry of OWNER_EMAILS (or owner@example.com); sign in with that email
 * and your login is linked to this contact (resolveSignedInContact).
 */
import { and, contactRoles, contacts, contactTags, createDb, eq, tags } from '../src';

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}
if (
  process.env.APP_ENV === 'production' ||
  process.env.VERCEL_ENV === 'production' ||
  process.env.NODE_ENV === 'production'
) {
  console.error('Refusing to seed a production environment.');
  process.exit(1);
}

const ownerEmail =
  (process.env.OWNER_EMAILS ?? '').split(',')[0]?.trim().toLowerCase() || 'owner@example.com';

const PEOPLE: {
  first: string;
  last: string;
  email: string;
  phone?: string;
  roles: ('owner' | 'admin' | 'manager' | 'staff')[];
  tags: string[];
}[] = [
  { first: 'Olivia', last: 'Owner', email: ownerEmail, roles: ['owner'], tags: ['staff'] },
  { first: 'Adam', last: 'Admin', email: 'admin@example.com', roles: ['admin'], tags: ['staff'] },
  {
    first: 'Maya',
    last: 'Manager',
    email: 'manager@example.com',
    roles: ['manager'],
    tags: ['staff'],
  },
  { first: 'Sam', last: 'Staff', email: 'staff@example.com', roles: ['staff'], tags: ['staff'] },
  {
    first: 'Casey',
    last: 'Customer',
    email: 'casey@example.com',
    phone: '+18165550101',
    roles: [],
    tags: ['customer'],
  },
  {
    first: 'Dana',
    last: 'Demo',
    email: 'dana@example.com',
    phone: '+18165550102',
    roles: [],
    tags: ['customer'],
  },
  { first: 'Lee', last: 'Lead', email: 'lee@example.com', roles: [], tags: ['lead'] },
];

const { db, end } = createDb(url, { max: 1 });
try {
  const tagIds = new Map((await db.select().from(tags)).map((t) => [t.slug, t.id]));
  let created = 0;
  for (const p of PEOPLE) {
    const [existing] = await db.select().from(contacts).where(eq(contacts.email, p.email));
    const contact =
      existing ??
      (
        await db
          .insert(contacts)
          .values({
            firstName: p.first,
            lastName: p.last,
            displayName: `${p.first} ${p.last}`,
            email: p.email,
            phone: p.phone ?? null,
            source: 'seed',
          })
          .returning()
      )[0]!;
    if (!existing) created++;
    for (const role of p.roles) {
      await db.insert(contactRoles).values({ contactId: contact.id, role }).onConflictDoNothing();
    }
    for (const slug of p.tags) {
      const tagId = tagIds.get(slug);
      if (!tagId) continue;
      const [has] = await db
        .select()
        .from(contactTags)
        .where(and(eq(contactTags.contactId, contact.id), eq(contactTags.tagId, tagId)));
      if (!has) await db.insert(contactTags).values({ contactId: contact.id, tagId });
    }
  }
  console.log(`Seeded ${created} new contact(s). Owner: ${ownerEmail}`);
} finally {
  await end();
}
