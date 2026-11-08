import { automationRuns, automationSteps, eq, events, getDb, jobs } from '@app/db';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { systemActor } from '../src/access';
import {
  addContactTags,
  archiveContact,
  callAction,
  createContact,
  grantRole,
  updateContact,
} from '../src/actions';
import { listEvents, recordSignIn } from '../src/actions/events';
import { emit } from '../src/events';
import { runDueJobs } from '../src/jobs';
import { assertLocalDatabase, makeActor, resetDatabase } from './setup';

beforeAll(assertLocalDatabase);
beforeEach(resetDatabase);

const types = async () => (await getDb().select().from(events)).map((e) => e.type).sort();

describe('emit (the outbox)', () => {
  it('records an event and queues its dispatch in the same transaction; dedupeKey records it once', async () => {
    const data = { contactId: crypto.randomUUID(), displayName: 'A' };
    const [first, second, other] = await getDb().transaction(async (tx) => [
      await emit(tx, 'contact.archived', data, { dedupeKey: 'k' }),
      await emit(tx, 'contact.archived', data, { dedupeKey: 'k' }),
      await emit(tx, 'contact.archived', data, { dedupeKey: 'k2' }),
    ]);
    expect(first).toBeTruthy();
    expect(second).toBeNull();
    expect(other).toBeTruthy();
    const queued = (await getDb().select().from(jobs)).filter((j) => j.type === 'events.dispatch');
    expect(queued).toHaveLength(2);
    const [e] = await getDb().select().from(events).where(eq(events.id, first!));
    expect(e).toMatchObject({ type: 'contact.archived', subjectType: 'contact', depth: 0 });
  });

  it('writes nothing when the transaction rolls back, and rejects data that does not fit', async () => {
    await getDb()
      .transaction(async (tx) => {
        await emit(tx, 'contact.archived', { contactId: crypto.randomUUID(), displayName: 'A' });
        throw new Error('rollback');
      })
      .catch(() => {
        // Expected: the rollback below is the point of this test.
      });
    expect(await types()).toEqual([]);
    await expect(
      getDb().transaction((tx) => emit(tx, 'contact.archived', { contactId: 'nope' } as never)),
    ).rejects.toThrow();
  });
});

describe('events emitted by the core actions', () => {
  it('contacts and roles announce what happened', async () => {
    const owner = await makeActor(['owner']);
    const created = await callAction(createContact, { firstName: 'Ann', tags: ['lead'] }, owner);
    if (!created.ok) throw new Error(created.error.message);
    const id = created.data.id;
    await callAction(updateContact, { id, phone: '816-555-0101' }, owner);
    await callAction(addContactTags, { id, tags: ['customer'] }, owner);
    await callAction(addContactTags, { id, tags: ['customer'] }, owner); // no-op: no second event
    await callAction(grantRole, { contactId: id, role: 'staff' }, owner);
    await callAction(archiveContact, { id }, owner);
    expect(await types()).toEqual([
      'contact.archived',
      'contact.created',
      'contact.tagged',
      'contact.updated',
      'role.granted',
    ]);
    const tagged = (await getDb().select().from(events)).find((e) => e.type === 'contact.tagged');
    expect(tagged?.data).toMatchObject({ tags: ['customer'], contactId: id });
  });
});

describe('events.list / events.recordSignIn', () => {
  it('lists events for automations.manage and refuses managers without it', async () => {
    const owner = await makeActor(['owner']);
    await callAction(createContact, { firstName: 'Ann' }, owner);
    const res = await callAction(listEvents, { type: 'contact.created' }, owner);
    expect(res.ok && res.data).toHaveLength(1);
    const manager = await makeActor(['manager']);
    expect(await callAction(listEvents, {}, manager)).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
  });

  it('turns a sign-in into a user.signed_in event, for the system only', async () => {
    const input = { contactId: crypto.randomUUID(), displayName: 'Pat', first: true };
    expect(await callAction(recordSignIn, input, systemActor())).toMatchObject({
      ok: true,
      data: { emitted: true },
    });
    expect(await types()).toEqual(['user.signed_in']);
    const owner = await makeActor(['owner']);
    expect(await callAction(recordSignIn, input, owner)).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
  });
});

describe('dispatch', () => {
  it('marks an event dispatched exactly once', async () => {
    const owner = await makeActor(['owner']);
    await callAction(createContact, { firstName: 'Ann' }, owner);
    await runDueJobs();
    const [e] = await getDb().select().from(events);
    expect(e!.dispatchedAt).toBeTruthy();
    expect(await getDb().select().from(automationRuns)).toHaveLength(0);
    expect(await getDb().select().from(automationSteps)).toHaveLength(0);
  });
});
