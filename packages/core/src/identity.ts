import {
  and,
  type AppRole,
  type Contact,
  contactRoles,
  contacts,
  contactTags,
  eq,
  getDb,
  ne,
  sql,
  tags,
} from '@app/db';

import { recordActivity } from './activity';
import { buildDisplayName } from './actions/contacts/shared';

export type AuthUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string | null;
};

export type SignedInContact =
  | {
      status: 'ok';
      contactId: string;
      displayName: string;
      roles: AppRole[];
    }
  | { status: 'verify_email' }
  | { status: 'disabled' };

/**
 * Connect a login (the auth provider's user) to its contact — the one person record.
 *
 * 1. Already linked → use that contact.
 * 2. A contact with the same VERIFIED email exists (e.g. staff added in admin,
 *    or a lead from the website) → link the login to it. Unverified emails are
 *    never linked, so nobody can claim someone else's record by signing up.
 * 3. Otherwise create a new contact tagged "lead" (they become "customer" on
 *    their first rental).
 *
 * Archived contacts (status = 'archived') are disabled: they can't use any app.
 *
 * Emails in OWNER_EMAILS become owner on verified sign-in ONLY while the
 * business has no owner at all — it's how the very first owner is created,
 * not a permanent override.
 */
export async function resolveSignedInContact(user: AuthUser): Promise<SignedInContact> {
  const db = getDb();
  const email = user.email.trim().toLowerCase();

  let [contact] = await db.select().from(contacts).where(eq(contacts.authUserId, user.id));

  if (!contact) {
    const [byEmail] = await db.select().from(contacts).where(eq(contacts.email, email));
    if (byEmail) {
      if (!user.emailVerified || (byEmail.authUserId && byEmail.authUserId !== user.id)) {
        return { status: 'verify_email' };
      }
      const [linked] = await db
        .update(contacts)
        .set({ authUserId: user.id })
        .where(and(eq(contacts.id, byEmail.id), sql`${contacts.authUserId} is null`))
        .returning();
      if (linked) await audit(linked.id, `Linked login to existing contact ${linked.displayName}`);
      // If a parallel request linked it first, read the result.
      [contact] = linked
        ? [linked]
        : await db.select().from(contacts).where(eq(contacts.authUserId, user.id));
    } else {
      const [firstName, ...rest] = (user.name ?? '').trim().split(/\s+/).filter(Boolean);
      const lastName = rest.join(' ') || null;
      const [created] = await db
        .insert(contacts)
        .values({
          firstName: firstName ?? null,
          lastName,
          displayName: buildDisplayName({ firstName, lastName, email }),
          email,
          authUserId: user.id,
          source: 'website',
        })
        .onConflictDoNothing()
        .returning();
      if (created) {
        await tagContact(created.id, 'lead');
        await audit(created.id, `New account: ${created.displayName}`);
      }
      // Lost a race with a parallel request: read what it created.
      [contact] = created
        ? [created]
        : await db.select().from(contacts).where(eq(contacts.authUserId, user.id));
    }
  }
  if (!contact) return { status: 'verify_email' };
  if (contact.status === 'archived') return { status: 'disabled' };
  if (user.emailVerified && contact.email !== email) contact = await syncLoginEmail(contact, email);

  let roles = (
    await db
      .select({ role: contactRoles.role })
      .from(contactRoles)
      .where(eq(contactRoles.contactId, contact.id))
  ).map((r) => r.role);

  if (user.emailVerified && !roles.includes('owner') && ownerEmails().includes(email)) {
    const [anyOwner] = await db
      .select({ id: contactRoles.contactId })
      .from(contactRoles)
      .where(eq(contactRoles.role, 'owner'))
      .limit(1);
    if (!anyOwner) {
      await db
        .insert(contactRoles)
        .values({ contactId: contact.id, role: 'owner' })
        .onConflictDoNothing();
      await tagContact(contact.id, 'staff');
      await audit(
        contact.id,
        `Granted owner to ${contact.displayName} (first owner, OWNER_EMAILS)`,
      );
      roles = [...roles, 'owner'];
    }
  }

  return {
    status: 'ok',
    contactId: contact.id,
    displayName: contact.displayName,
    roles,
  };
}

/**
 * The person changed their sign-in email (My account → confirmation link to the
 * new address) → make it the contact's email too. The old one stays in the
 * contact's history (the record history). Skipped, and noted, if another
 * contact already uses the new address — staff merge those by hand.
 */
async function syncLoginEmail(contact: Contact, email: string): Promise<Contact> {
  const db = getDb();
  const [taken] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.email, email), ne(contacts.id, contact.id)));
  if (taken) {
    await audit(
      contact.id,
      `${contact.displayName} now signs in as ${email}, but another contact has that email — not copied`,
    );
    return contact;
  }
  const [updated] = await db
    .update(contacts)
    .set({ email })
    .where(eq(contacts.id, contact.id))
    .returning();
  await audit(
    contact.id,
    `${contact.displayName} changed their email to ${email} (confirmed by link)`,
  );
  return updated!;
}

function ownerEmails() {
  return (process.env.OWNER_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

async function tagContact(contactId: string, slug: string) {
  const db = getDb();
  const [tag] = await db.select({ id: tags.id }).from(tags).where(eq(tags.slug, slug));
  if (tag) await db.insert(contactTags).values({ contactId, tagId: tag.id }).onConflictDoNothing();
}

async function audit(contactId: string, summary: string) {
  await recordActivity({
    kind: 'auth',
    action: 'identity.signIn',
    actorKind: 'system',
    channel: 'web',
    subjectType: 'contact',
    subjectId: contactId,
    summary,
    ok: true,
  });
}
