import { apiKeys, eq, getDb } from '@app/db';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { guestActor } from '../src/access';
import {
  archiveContact,
  callAction,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  runAction,
  updateMyAccount,
} from '../src/actions';
import { actorFromApiKey, hashApiKey } from '../src/api-keys';
import { assertLocalDatabase, makeActor, resetDatabase } from './setup';

beforeAll(assertLocalDatabase);
beforeEach(resetDatabase);

describe('api keys', () => {
  it('creates a key (secret shown once, only the hash stored), lists it and revokes it', async () => {
    const manager = await makeActor(['manager']);
    const created = await callAction(createApiKey, { name: 'Claude' }, manager);
    if (!created.ok) throw new Error(created.error.message);
    expect(created.data.key).toMatch(/^app_sk_/);
    const [row] = await getDb().select().from(apiKeys);
    expect(row?.keyHash).toBe(hashApiKey(created.data.key));
    expect(JSON.stringify(created.data.apiKey)).not.toContain(created.data.key);

    const list = await callAction(listApiKeys, {}, manager);
    expect(list.ok && list.data.map((k) => k.name)).toEqual(['Claude']);
    expect(await actorFromApiKey(created.data.key, 'api')).toMatchObject({
      kind: 'api_key',
      contactId: manager.contactId,
    });

    expect(await callAction(revokeApiKey, { id: created.data.apiKey.id }, manager)).toMatchObject({
      ok: true,
    });
    expect(await actorFromApiKey(created.data.key, 'api')).toBeNull();
  });

  it('refuses callers without api_keys.manage, and other people’s keys', async () => {
    const manager = await makeActor(['manager']);
    const created = await callAction(createApiKey, { name: 'Mine' }, manager);
    if (!created.ok) throw new Error(created.error.message);
    for (const actor of [await makeActor(['staff']), await makeActor([]), guestActor()]) {
      for (const [action, input] of [
        ['apiKeys.create', { name: 'x' }],
        ['apiKeys.list', {}],
        ['apiKeys.revoke', { id: created.data.apiKey.id }],
      ] as const) {
        const res = await runAction(action, input, actor);
        expect(res.ok).toBe(false);
        if (!res.ok) expect(['forbidden', 'unauthenticated']).toContain(res.error.code);
      }
    }
    const other = await makeActor(['owner']);
    expect(await callAction(revokeApiKey, { id: created.data.apiKey.id }, other)).toMatchObject({
      ok: false,
      error: { code: 'not_found' },
    });
  });

  it('a key can be narrowed; narrowed keys cannot make "any signed-in user" changes; keys cannot mint keys', async () => {
    const owner = await makeActor(['owner']);
    const created = await callAction(
      createApiKey,
      { name: 'Read only', permissions: ['users.read', 'api_keys.manage'] },
      owner,
    );
    if (!created.ok) throw new Error(created.error.message);
    const ai = (await actorFromApiKey(created.data.key, 'mcp'))!;
    expect(ai.restricted).toBe(true);
    expect(await runAction('contacts.list', {}, ai)).toMatchObject({ ok: true });
    expect(await runAction('settings.list', {}, ai)).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(await callAction(updateMyAccount, { firstName: 'Hacked' }, ai)).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(await callAction(createApiKey, { name: 'child' }, ai)).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
  });

  it('expired keys and keys of archived contacts stop working', async () => {
    const owner = await makeActor(['owner']);
    const manager = await makeActor(['manager']);
    const created = await callAction(createApiKey, { name: 'k' }, manager);
    if (!created.ok) throw new Error(created.error.message);
    expect(await actorFromApiKey(created.data.key, 'api')).not.toBeNull();

    await getDb()
      .update(apiKeys)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(apiKeys.id, created.data.apiKey.id));
    expect(await actorFromApiKey(created.data.key, 'api')).toBeNull();

    await getDb()
      .update(apiKeys)
      .set({ expiresAt: null })
      .where(eq(apiKeys.id, created.data.apiKey.id));
    expect(await actorFromApiKey(created.data.key, 'api')).not.toBeNull();
    await callAction(archiveContact, { id: manager.contactId! }, owner);
    expect(await actorFromApiKey(created.data.key, 'api')).toBeNull();
    expect(await actorFromApiKey('not-a-key', 'api')).toBeNull();
  });
});
