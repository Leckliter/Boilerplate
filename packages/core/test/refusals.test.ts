/**
 * Checks that run over ALL actions at once. Every action that isn't public refuses
 * callers who lack its permission —
 * checked for ALL actions at once, so a new action can't accidentally be open
 * to everyone. (Each action still needs its own happy-path test.)
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { guestActor, hasPermission } from '../src/access';
import { runAction } from '../src/actions';
import { listActions } from '../src/actions/registry';
import { assertLocalDatabase, makeActor, resetDatabase } from './setup';

beforeAll(assertLocalDatabase);
beforeAll(resetDatabase);

const guarded = listActions().filter((a) => a.audience !== 'public');

describe('every non-public action refuses the wrong caller', () => {
  it.each(guarded.map((a) => [a.name, a.audience] as const))('%s (%s)', async (name, audience) => {
    // Signed out for "authenticated" actions; signed in with no roles for everything else.
    const actor = audience === 'authenticated' ? guestActor() : await makeActor([]);
    expect(hasPermission(actor, audience)).toBe(false);
    const result = await runAction(name, {}, actor);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(['forbidden', 'unauthenticated']).toContain(result.error.code);
  });
});

/**
 * Every read-only action that needs no input works for an owner on an empty
 * database — a cheap smoke test for every list screen.
 */
const simpleReads = listActions().filter(
  (a) => !a.mutates && a.audience !== 'system' && a.input.safeParse({}).success,
);

describe('every no-input read works for an owner', () => {
  it.each(simpleReads.map((a) => [a.name] as const))('%s', async (name) => {
    const owner = await makeActor(['owner']);
    const result = await runAction(name, {}, owner);
    expect(result.ok ? 'ok' : result.error).toBe('ok');
  });
});
