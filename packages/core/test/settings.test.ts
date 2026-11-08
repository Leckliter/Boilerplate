import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { guestActor } from '../src/access';
import {
  callAction,
  getSetting,
  listIntegrations,
  listSettings,
  runAction,
  setSetting,
  updateIntegration,
} from '../src/actions';
import { assertLocalDatabase, makeActor, resetDatabase } from './setup';

beforeAll(assertLocalDatabase);
beforeEach(resetDatabase);

describe('settings', () => {
  it('sets, replaces, reads and lists JSON settings', async () => {
    const manager = await makeActor(['manager']);
    expect(await callAction(getSetting, { key: 'business.name' }, manager)).toMatchObject({
      ok: true,
      data: { value: null },
    });
    await callAction(setSetting, { key: 'business.name', value: 'Acme' }, manager);
    await callAction(setSetting, { key: 'business.hours', value: { open: 9, close: 17 } }, manager);
    await callAction(setSetting, { key: 'business.name', value: 'Acme Inc' }, manager);
    expect(await callAction(getSetting, { key: 'business.name' }, manager)).toMatchObject({
      data: { value: 'Acme Inc' },
    });
    const list = await callAction(listSettings, {}, manager);
    expect(list.ok && list.data.map((s) => s.key)).toEqual(['business.hours', 'business.name']);
  });

  it('refuses callers without settings.manage and bad keys', async () => {
    const staff = await makeActor(['staff']);
    for (const [action, input] of [
      ['settings.list', {}],
      ['settings.get', { key: 'a.b' }],
      ['settings.set', { key: 'a.b', value: 1 }],
    ] as const) {
      expect(await runAction(action, input, staff)).toMatchObject({
        ok: false,
        error: { code: 'forbidden' },
      });
      expect((await runAction(action, input, guestActor())).ok).toBe(false);
    }
    expect(
      await callAction(setSetting, { key: 'Bad Key!', value: 1 }, await makeActor(['manager'])),
    ).toMatchObject({ ok: false, error: { code: 'invalid_input' } });
  });
});

describe('integrations', () => {
  it('lists status from env and stores the kill switch', async () => {
    const manager = await makeActor(['manager']);
    const before = await callAction(listIntegrations, {}, manager);
    expect(before.ok && before.data.find((i) => i.id === 'email')).toMatchObject({
      enabled: true,
      configured: expect.any(Boolean),
    });
    expect(
      await callAction(updateIntegration, { id: 'email', enabled: false }, manager),
    ).toMatchObject({ ok: true, data: { id: 'email', enabled: false } });
    const after = await callAction(listIntegrations, {}, manager);
    expect(after.ok && after.data.find((i) => i.id === 'email')?.enabled).toBe(false);
    expect(
      await callAction(updateIntegration, { id: 'email', config: { from: 'a@b.co' } }, manager),
    ).toMatchObject({ ok: true, data: { enabled: false, config: { from: 'a@b.co' } } });
    expect(
      await callAction(updateIntegration, { id: 'nope', enabled: true }, manager),
    ).toMatchObject({
      ok: false,
      error: { code: 'not_found' },
    });
  });

  it('refuses callers without settings.manage', async () => {
    const staff = await makeActor(['staff']);
    expect(await callAction(listIntegrations, {}, staff)).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(
      await callAction(updateIntegration, { id: 'email', enabled: false }, staff),
    ).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
  });
});
