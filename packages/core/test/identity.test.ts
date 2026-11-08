import { activityLog, contactRoles, contacts, eq, getDb } from '@app/db';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { archiveContact, callAction, createContact } from '../src/actions';
import { resolveSignedInContact } from '../src/identity';
import { assertLocalDatabase, makeActor, resetDatabase } from './setup';

beforeAll(assertLocalDatabase);
beforeEach(resetDatabase);

describe('resolveSignedInContact', () => {
  it('creates a lead contact for a brand-new verified login', async () => {
    const res = await resolveSignedInContact({
      id: 'user-1',
      email: 'New@Example.com',
      emailVerified: true,
      name: 'Nia North',
    });
    expect(res).toMatchObject({ status: 'ok', displayName: 'Nia North', roles: [] });
    const [c] = await getDb().select().from(contacts).where(eq(contacts.authUserId, 'user-1'));
    expect(c).toMatchObject({ email: 'new@example.com', source: 'website' });
    // Calling again finds the same contact.
    expect(
      await resolveSignedInContact({ id: 'user-1', email: 'new@example.com', emailVerified: true }),
    ).toMatchObject({
      status: 'ok',
      contactId: c!.id,
    });
  });

  it('links an existing contact only when the email is verified', async () => {
    const manager = await makeActor(['manager']);
    const made = await callAction(
      createContact,
      { firstName: 'Sam', email: 'sam@example.com' },
      manager,
    );
    const id = made.ok ? made.data.id : '';
    expect(
      await resolveSignedInContact({
        id: 'auth-sam',
        email: 'sam@example.com',
        emailVerified: false,
      }),
    ).toEqual({ status: 'verify_email' });
    expect(
      await resolveSignedInContact({
        id: 'auth-sam',
        email: 'sam@example.com',
        emailVerified: true,
      }),
    ).toMatchObject({ status: 'ok', contactId: id });
    // A different login can't take over an already-linked contact.
    expect(
      await resolveSignedInContact({
        id: 'auth-evil',
        email: 'sam@example.com',
        emailVerified: true,
      }),
    ).toEqual({ status: 'verify_email' });
  });

  it('archived contacts are disabled', async () => {
    const owner = await makeActor(['owner']);
    const made = await callAction(
      createContact,
      { firstName: 'Gone', email: 'gone@example.com' },
      owner,
    );
    await resolveSignedInContact({
      id: 'auth-gone',
      email: 'gone@example.com',
      emailVerified: true,
    });
    await callAction(archiveContact, { id: made.ok ? made.data.id : '' }, owner);
    expect(
      await resolveSignedInContact({
        id: 'auth-gone',
        email: 'gone@example.com',
        emailVerified: true,
      }),
    ).toEqual({ status: 'disabled' });
  });

  it('OWNER_EMAILS makes the first owner only while there is no owner at all; a changed email is synced', async () => {
    process.env.OWNER_EMAILS = 'boss@example.com, other@example.com';
    try {
      const first = await resolveSignedInContact({
        id: 'a-boss',
        email: 'boss@example.com',
        emailVerified: true,
      });
      expect(first).toMatchObject({ status: 'ok', roles: ['owner'] });
      const second = await resolveSignedInContact({
        id: 'a-other',
        email: 'other@example.com',
        emailVerified: true,
      });
      expect(second).toMatchObject({ status: 'ok', roles: [] });
      expect(await getDb().select().from(contactRoles)).toHaveLength(1);

      // The provider says the person confirmed a new email: copy it to the contact.
      const moved = await resolveSignedInContact({
        id: 'a-other',
        email: 'moved@example.com',
        emailVerified: true,
      });
      expect(moved.status).toBe('ok');
      const [c] = await getDb().select().from(contacts).where(eq(contacts.authUserId, 'a-other'));
      expect(c?.email).toBe('moved@example.com');
      const logged = await getDb().select().from(activityLog);
      expect(logged.map((l) => l.summary).join('\n')).toContain('first owner');
    } finally {
      delete process.env.OWNER_EMAILS;
    }
  });
});
