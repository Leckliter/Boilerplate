import { contactRoles, contacts, eq, getDb } from '@app/db';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { guestActor } from '../src/access';
import {
  addContactTags,
  archiveContact,
  callAction,
  createContact,
  getContact,
  grantRole,
  listContacts,
  removeContactTags,
  restoreContact,
  updateContact,
} from '../src/actions';
import { assertLocalDatabase, makeActor, resetDatabase } from './setup';

beforeAll(assertLocalDatabase);
beforeEach(resetDatabase);

async function make(input: Record<string, unknown>) {
  const manager = await makeActor(['manager']);
  const res = await callAction(createContact, input as never, manager);
  if (!res.ok) throw new Error(res.error.message);
  return res.data;
}

describe('contacts.create', () => {
  it('creates a contact with tags, a normalised phone and a derived display name', async () => {
    const c = await make({
      firstName: 'Ann',
      lastName: 'Lee',
      email: 'ANN@Example.com',
      phone: '(816) 555-0101',
      tags: ['lead'],
    });
    expect(c).toMatchObject({
      displayName: 'Ann Lee',
      email: 'ann@example.com',
      phone: '+18165550101',
      status: 'active',
      hasLogin: false,
      tags: [expect.objectContaining({ slug: 'lead' })],
    });
  });

  it('refuses people without users.manage, and unknown tags and duplicate emails', async () => {
    const staff = await makeActor(['staff']);
    expect(await callAction(createContact, { firstName: 'X' }, staff)).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(await callAction(createContact, { firstName: 'X' }, guestActor())).toMatchObject({
      ok: false,
      error: { code: 'unauthenticated' },
    });
    const manager = await makeActor(['manager']);
    expect(
      await callAction(createContact, { firstName: 'X', tags: ['no-such-tag'] }, manager),
    ).toMatchObject({ ok: false, error: { code: 'invalid_input' } });
    await make({ email: 'dup@example.com' });
    expect(await callAction(createContact, { email: 'dup@example.com' }, manager)).toMatchObject({
      ok: false,
      error: { code: 'conflict' },
    });
    expect(await callAction(createContact, {}, manager)).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
  });
});

describe('contacts.list / contacts.get', () => {
  it('searches by name, email, phone and tag, and hides archived contacts', async () => {
    const ann = await make({ firstName: 'Ann', email: 'ann@example.com', tags: ['customer'] });
    await make({ firstName: 'Bo', phone: '816-555-0199', tags: ['lead'] });
    const staff = await makeActor(['staff']); // read-only role
    const list = (input: object) =>
      callAction(listContacts, input as never, staff).then((r) => {
        if (!r.ok) throw new Error(r.error.message);
        return r.data;
      });

    expect((await list({ search: 'ann' })).contacts.map((c) => c.displayName)).toContain('Ann');
    expect((await list({ search: '555-0199' })).contacts.map((c) => c.displayName)).toEqual(['Bo']);
    expect((await list({ tag: 'customer' })).contacts.map((c) => c.id)).toEqual([ann.id]);

    const manager = await makeActor(['manager']);
    await callAction(archiveContact, { id: ann.id }, manager);
    expect((await list({ search: 'ann' })).contacts).toHaveLength(0);
    expect((await list({ search: 'ann', includeArchived: true })).contacts).toHaveLength(1);

    const got = await callAction(getContact, { id: ann.id }, staff);
    expect(got).toMatchObject({ ok: true, data: { id: ann.id, status: 'archived' } });
  });

  it('refuses customers and guests', async () => {
    const customer = await makeActor([]);
    expect(await callAction(listContacts, {}, customer)).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(await callAction(getContact, { id: crypto.randomUUID() }, customer)).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(
      await callAction(getContact, { id: crypto.randomUUID() }, await makeActor(['staff'])),
    ).toMatchObject({
      ok: false,
      error: { code: 'not_found' },
    });
  });
});

describe('contacts.update', () => {
  it('changes only the fields sent and keeps the display name in step', async () => {
    const c = await make({ firstName: 'Ann', email: 'ann@example.com' });
    const manager = await makeActor(['manager']);
    const res = await callAction(
      updateContact,
      { id: c.id, lastName: 'Lee', notes: 'VIP' },
      manager,
    );
    expect(res).toMatchObject({
      ok: true,
      data: { displayName: 'Ann Lee', notes: 'VIP', email: 'ann@example.com' },
    });
  });

  it('refuses callers without users.manage; changing the email of someone with a role needs roles.manage', async () => {
    const c = await make({ firstName: 'Ann', email: 'ann@example.com' });
    expect(
      await callAction(updateContact, { id: c.id, notes: 'x' }, await makeActor(['staff'])),
    ).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
    const owner = await makeActor(['owner']);
    await callAction(grantRole, { contactId: c.id, role: 'staff' }, owner);
    const manager = await makeActor(['manager']);
    expect(
      await callAction(updateContact, { id: c.id, email: 'new@example.com' }, manager),
    ).toMatchObject({ ok: false, error: { code: 'forbidden' } });
    expect(
      await callAction(updateContact, { id: c.id, email: 'new@example.com' }, owner),
    ).toMatchObject({ ok: true, data: { email: 'new@example.com' } });
  });

  it('refuses an email another contact already has', async () => {
    const a = await make({ email: 'a@example.com' });
    await make({ email: 'b@example.com' });
    const manager = await makeActor(['manager']);
    expect(
      await callAction(updateContact, { id: a.id, email: 'b@example.com' }, manager),
    ).toMatchObject({
      ok: false,
      error: { code: 'conflict' },
    });
  });
});

describe('contacts.archive / contacts.restore', () => {
  it('archives and restores; refuses without users.manage', async () => {
    const c = await make({ firstName: 'Ann' });
    const manager = await makeActor(['manager']);
    expect(
      await callAction(archiveContact, { id: c.id }, await makeActor(['staff'])),
    ).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(await callAction(archiveContact, { id: c.id }, manager)).toMatchObject({
      ok: true,
      data: { status: 'archived' },
    });
    expect(await callAction(restoreContact, { id: c.id }, await makeActor([]))).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(await callAction(restoreContact, { id: c.id }, manager)).toMatchObject({
      ok: true,
      data: { status: 'active' },
    });
  });

  it('never archives the last owner', async () => {
    const owner = await makeActor(['owner']);
    const res = await callAction(archiveContact, { id: owner.contactId! }, owner);
    expect(res).toMatchObject({ ok: false, error: { code: 'conflict' } });
    const second = await makeActor(['owner']);
    expect((await callAction(archiveContact, { id: second.contactId! }, owner)).ok).toBe(true);
    const [row] = await getDb().select().from(contacts).where(eq(contacts.id, second.contactId!));
    expect(row?.status).toBe('archived');
    expect(await getDb().select().from(contactRoles)).toHaveLength(2); // roles are kept
  });
});

describe('contacts.addTags / contacts.removeTags', () => {
  it('adds (idempotently) and removes tags; tags never grant access', async () => {
    const c = await make({ firstName: 'Ann' });
    const manager = await makeActor(['manager']);
    await callAction(addContactTags, { id: c.id, tags: ['customer', 'staff'] }, manager);
    const again = await callAction(addContactTags, { id: c.id, tags: ['staff'] }, manager);
    expect(again.ok && again.data.tags.map((t) => t.slug).sort()).toEqual(['customer', 'staff']);
    expect(again.ok && again.data.roles).toEqual([]); // the `staff` TAG granted no role
    const removed = await callAction(removeContactTags, { id: c.id, tags: ['staff'] }, manager);
    expect(removed.ok && removed.data.tags.map((t) => t.slug)).toEqual(['customer']);
  });

  it('refuses callers without users.manage', async () => {
    const c = await make({ firstName: 'Ann' });
    for (const actor of [await makeActor(['staff']), await makeActor([])]) {
      expect(await callAction(addContactTags, { id: c.id, tags: ['lead'] }, actor)).toMatchObject({
        ok: false,
        error: { code: 'forbidden' },
      });
      expect(
        await callAction(removeContactTags, { id: c.id, tags: ['lead'] }, actor),
      ).toMatchObject({ ok: false, error: { code: 'forbidden' } });
    }
  });
});
