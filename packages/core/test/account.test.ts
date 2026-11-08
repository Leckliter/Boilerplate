import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { guestActor, systemActor } from '../src/access';
import { callAction, getMyAccount, updateMyAccount, whoami } from '../src/actions';
import { assertLocalDatabase, makeActor, resetDatabase } from './setup';

beforeAll(assertLocalDatabase);
beforeEach(resetDatabase);

describe('my account', () => {
  it('any signed-in person (a customer with no role) reads and edits their own details', async () => {
    const me = await makeActor([], 'Casey Customer');
    expect(await callAction(getMyAccount, {}, me)).toMatchObject({
      ok: true,
      data: { id: me.contactId, displayName: 'Casey Customer', roles: [] },
    });
    const res = await callAction(
      updateMyAccount,
      { firstName: 'Casey', lastName: 'Jones', phone: '816-555-0100' },
      me,
    );
    expect(res).toMatchObject({
      ok: true,
      data: { displayName: 'Casey Jones', phone: '+18165550100' },
    });
  });

  it('refuses signed-out visitors; the system has no account', async () => {
    expect(await callAction(getMyAccount, {}, guestActor())).toMatchObject({
      ok: false,
      error: { code: 'unauthenticated' },
    });
    expect(await callAction(updateMyAccount, { firstName: 'X' }, guestActor())).toMatchObject({
      ok: false,
      error: { code: 'unauthenticated' },
    });
    expect(await callAction(getMyAccount, {}, systemActor())).toMatchObject({
      ok: false,
      error: { code: 'not_found' },
    });
  });

  it('whoami reports roles and permissions; guests are refused', async () => {
    const staff = await makeActor(['staff']);
    const res = await callAction(whoami, {}, staff);
    expect(res).toMatchObject({ ok: true, data: { roles: ['staff'], environment: 'local' } });
    expect(res.ok && res.data.permissions).toContain('admin.access');
    expect(await callAction(whoami, {}, guestActor())).toMatchObject({
      ok: false,
      error: { code: 'unauthenticated' },
    });
  });
});
