import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { guestActor, ROLE_PERMISSIONS } from '../src/access';
import {
  callAction,
  createContact,
  createTag,
  deleteTag,
  grantRole,
  listRoles,
  listStaff,
  listTags,
  revokeRole,
} from '../src/actions';
import { assertLocalDatabase, makeActor, resetDatabase } from './setup';

beforeAll(assertLocalDatabase);
beforeEach(resetDatabase);

async function newContact() {
  const res = await callAction(
    createContact,
    { firstName: 'New', email: `n${Date.now()}@example.com` },
    await makeActor(['manager']),
  );
  if (!res.ok) throw new Error(res.error.message);
  return res.data;
}

describe('roles', () => {
  it('lists the roles and what each grants, to any signed-in person (not guests)', async () => {
    const res = await callAction(listRoles, {}, await makeActor([]));
    expect(res.ok && res.data.map((r) => r.role)).toEqual(['owner', 'admin', 'manager', 'staff']);
    expect(res.ok && res.data.find((r) => r.role === 'staff')?.permissions).toEqual(
      ROLE_PERMISSIONS.staff,
    );
    expect(await callAction(listRoles, {}, guestActor())).toMatchObject({
      ok: false,
      error: { code: 'unauthenticated' },
    });
  });

  it('grants and revokes roles; listStaff shows everyone with a role', async () => {
    const owner = await makeActor(['owner']);
    const c = await newContact();
    const granted = await callAction(grantRole, { contactId: c.id, role: 'manager' }, owner);
    expect(granted).toMatchObject({ ok: true, data: { roles: ['manager'] } });
    const staff = await callAction(listStaff, {}, owner);
    expect(staff.ok && staff.data.map((s) => s.id)).toContain(c.id);
    expect(await callAction(revokeRole, { contactId: c.id, role: 'manager' }, owner)).toMatchObject(
      {
        ok: true,
        data: { roles: [] },
      },
    );
  });

  it('refuses people without roles.manage', async () => {
    const c = await newContact();
    for (const actor of [
      await makeActor(['manager']),
      await makeActor(['staff']),
      await makeActor([]),
    ]) {
      expect(await callAction(grantRole, { contactId: c.id, role: 'staff' }, actor)).toMatchObject({
        ok: false,
        error: { code: 'forbidden' },
      });
      expect(await callAction(revokeRole, { contactId: c.id, role: 'staff' }, actor)).toMatchObject(
        {
          ok: false,
          error: { code: 'forbidden' },
        },
      );
      expect(await callAction(listStaff, {}, actor)).toMatchObject({
        ok: false,
        error: { code: 'forbidden' },
      });
    }
  });

  it('only an owner can grant or remove owner; the last owner can never be removed', async () => {
    const owner = await makeActor(['owner']);
    const admin = await makeActor(['admin']);
    const c = await newContact();
    expect(await callAction(grantRole, { contactId: c.id, role: 'owner' }, admin)).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect((await callAction(grantRole, { contactId: c.id, role: 'admin' }, admin)).ok).toBe(true);
    expect(
      await callAction(revokeRole, { contactId: owner.contactId!, role: 'owner' }, owner),
    ).toMatchObject({ ok: false, error: { code: 'conflict' } });
  });
});

describe('tags', () => {
  it('creates, lists (with counts) and deletes tags; system tags cannot be deleted', async () => {
    const manager = await makeActor(['manager']);
    const created = await callAction(createTag, { slug: 'net-30', label: 'Net 30' }, manager);
    expect(created).toMatchObject({ ok: true, data: { slug: 'net-30', kind: 'label' } });
    expect(await callAction(createTag, { slug: 'net-30', label: 'Again' }, manager)).toMatchObject({
      ok: false,
      error: { code: 'conflict' },
    });
    const list = await callAction(listTags, {}, await makeActor(['staff']));
    expect(list.ok && list.data.map((t) => t.slug)).toEqual(
      expect.arrayContaining(['customer', 'lead', 'staff', 'vendor', 'net-30']),
    );
    expect(await callAction(deleteTag, { slug: 'customer' }, manager)).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(await callAction(deleteTag, { slug: 'net-30' }, manager)).toMatchObject({
      ok: true,
      data: { slug: 'net-30' },
    });
  });

  it('refuses callers without the permission', async () => {
    const staff = await makeActor(['staff']);
    expect(await callAction(createTag, { slug: 'abc', label: 'Abc' }, staff)).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(await callAction(deleteTag, { slug: 'abc' }, staff)).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(await callAction(listTags, {}, await makeActor([]))).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
  });
});
