import { activityLog, changeLog, contacts, eq, errorEvents, getDb, sql, type Tx } from '@app/db';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { guestActor, withRequest } from '../src/access';
import { recordAuthEvent } from '../src/activity';
import {
  ActionError,
  callAction,
  createApiKey,
  createContact,
  defineAction,
  getActivity,
  getError,
  listActivity,
  listChanges,
  listContacts,
  listErrors,
  resolveError,
  updateContact,
} from '../src/actions';
import { actorFromApiKey } from '../src/api-keys';
import { diagnose } from '../src/errors/diagnose';
import { registerErrorAlerts } from '../src/errors/alerts';
import { fingerprint } from '../src/errors/fingerprint';
import { reportError, SPIKE_THRESHOLD } from '../src/errors/report';
import { assertLocalDatabase, makeActor, resetDatabase } from './setup';

beforeAll(assertLocalDatabase);
beforeEach(resetDatabase);

const request = { id: 'req-1', ip: '203.0.113.7', userAgent: 'Vitest', path: '/admin' };

/** An action that hits a bug, to exercise the error path. */
const buggy = defineAction({
  name: 'test.buggy',
  title: 'Buggy',
  description: 'Throws.',
  audience: 'users.manage',
  mutates: true,
  returns: 'never',
  input: z.object({ id: z.uuid(), password: z.string().optional() }),
  async run({ input, tx }): Promise<never> {
    await tx.update(contacts).set({ notes: 'half-done' }).where(eq(contacts.id, input.id));
    const missing = undefined as unknown as { name: string };
    return missing.name as never;
  },
});

async function ann(actor: Awaited<ReturnType<typeof makeActor>>) {
  const res = await callAction(
    createContact,
    { firstName: 'Ann', email: 'ann@example.com', phone: '816-555-0101' },
    actor,
  );
  if (!res.ok) throw new Error(res.error.message);
  return res.data;
}

describe('activity log', () => {
  it('records who changed what, from where, with before → after values', async () => {
    const staff = withRequest(await makeActor(['manager']), request);
    const contact = await ann(staff);
    const res = await callAction(updateContact, { id: contact.id, phone: '816-555-0199' }, staff);
    expect(res.ok).toBe(true);

    const [entry] = await getDb()
      .select()
      .from(activityLog)
      .where(eq(activityLog.action, 'contacts.update'));
    expect(entry).toMatchObject({
      kind: 'change',
      actorContactId: staff.contactId,
      channel: 'web',
      subjectId: contact.id,
      ok: true,
      requestId: 'req-1',
      ip: '203.0.113.7',
      userAgent: 'Vitest',
    });

    const owner = await makeActor(['owner']);
    const detail = await callAction(getActivity, { id: entry!.id }, owner);
    expect(detail.ok && detail.data.changes).toEqual([
      expect.objectContaining({
        tableName: 'contacts',
        op: 'update',
        before: { phone: '+18165550101' },
        after: { phone: '+18165550199' },
      }),
    ]);
    // The create in the same request shows up as a sibling entry.
    expect(detail.ok && detail.data.sameRequest.map((a) => a.action)).toEqual(['contacts.create']);
  });

  it('keeps a field-level history of a record, including writes made outside the app', async () => {
    const staff = await makeActor(['manager']);
    const contact = await ann(staff);
    await callAction(updateContact, { id: contact.id, lastName: 'Lee' }, staff);
    // e.g. someone fixing data in the Supabase SQL editor:
    await getDb()
      .update(contacts)
      .set({ notes: 'fixed by hand' })
      .where(eq(contacts.id, contact.id));

    const owner = await makeActor(['owner']);
    const history = await callAction(listChanges, { subjectId: contact.id }, owner);
    expect(history.ok).toBe(true);
    if (!history.ok) return;
    const [byHand, update] = history.data;
    expect(byHand).toMatchObject({ activityId: null, after: { notes: 'fixed by hand' } });
    expect(update).toMatchObject({
      action: 'contacts.update',
      actorName: expect.any(String),
      after: { last_name: 'Lee', display_name: 'Ann Lee' },
    });
    expect(history.data.at(-1)).toMatchObject({ tableName: 'contacts', op: 'insert' });
  });

  it('a failed change leaves no change rows (it rolled back) but is logged as failed', async () => {
    const staff = await makeActor(['manager']);
    const contact = await ann(staff);
    await getDb().execute(sql`truncate app.change_log`);
    const res = await callAction(buggy, { id: contact.id }, staff);
    expect(res.ok).toBe(false);
    expect(await getDb().select().from(changeLog)).toHaveLength(0);
    const [entry] = await getDb()
      .select()
      .from(activityLog)
      .where(eq(activityLog.action, 'test.buggy'));
    expect(entry).toMatchObject({ ok: false, errorCode: 'internal' });
    expect(entry!.errorRef).toMatch(/^E-[2-9A-Z]{8}$/);
  });

  it('records denied attempts by signed-in people, but not by guests', async () => {
    const customer = await makeActor([]);
    expect(await callAction(listContacts, {}, customer)).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
    await callAction(listContacts, {}, guestActor());
    const rows = await getDb().select().from(activityLog);
    expect(rows).toEqual([
      expect.objectContaining({
        action: 'contacts.list',
        kind: 'read',
        actorContactId: customer.contactId,
        ok: false,
        errorCode: 'forbidden',
      }),
    ]);
  });

  it('records every API/MCP call, reads included; people browsing the apps are not', async () => {
    const manager = await makeActor(['manager']);
    await callAction(listContacts, {}, manager);
    expect(await getDb().select().from(activityLog)).toHaveLength(0);

    const created = await callAction(createApiKey, { name: 'Claude' }, manager);
    if (!created.ok) throw new Error(created.error.message);
    const ai = (await actorFromApiKey(created.data.key, 'mcp'))!;
    await callAction(listContacts, { tag: 'lead' }, ai);
    await callAction(createContact, { firstName: 'Bo' }, ai);

    const owner = await makeActor(['owner']);
    const res = await callAction(listActivity, { apiKeyId: created.data.apiKey.id }, owner);
    expect(res.ok && res.data.map((a) => [a.action, a.kind, a.channel, a.apiKeyName])).toEqual([
      ['contacts.create', 'change', 'mcp', 'Claude'],
      ['contacts.list', 'read', 'mcp', 'Claude'],
    ]);
  });

  it('records invalid input on changes', async () => {
    const staff = await makeActor(['manager']);
    await callAction(createContact, { email: 'not-an-email' }, staff);
    const [row] = await getDb().select().from(activityLog);
    expect(row).toMatchObject({ ok: false, errorCode: 'invalid_input', action: 'contacts.create' });
  });

  it('records sign-ins against the right contact; failed attempts are not attributed to them', async () => {
    const staff = await makeActor(['manager']);
    const contact = await ann(staff);
    await recordAuthEvent({
      action: 'auth.signIn',
      ok: true,
      summary: 'Signed in with password',
      email: 'ANN@example.com',
      request,
    });
    await recordAuthEvent({
      action: 'auth.signInFailed',
      ok: false,
      summary: 'Wrong password',
      email: 'ann@example.com',
    });
    const rows = await getDb().select().from(activityLog).where(eq(activityLog.kind, 'auth'));
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'auth.signIn',
          actorKind: 'user',
          actorContactId: contact.id,
          subjectId: contact.id,
          ip: request.ip,
        }),
        expect.objectContaining({
          action: 'auth.signInFailed',
          actorKind: 'guest',
          actorContactId: null,
          subjectId: contact.id,
          ok: false,
        }),
      ]),
    );
  });

  it('every app table records its changes (new tables must call app.track_changes)', async () => {
    const untracked = await getDb().execute<{ table_name: string }>(sql`
      select c.relname as table_name
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'app' and c.relkind = 'r'
        and c.relname not in ('activity_log', 'change_log', 'error_events', 'notifications', 'notification_deliveries', 'rate_limit_hits', 'jobs', 'cron_runs', 'idempotency_keys', 'events', 'automation_runs', 'automation_steps')
        and not exists (
          select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname = 'record_change'
        )`);
    expect([...untracked].map((r) => r.table_name)).toEqual([]);
  });
});

describe('error reports', () => {
  it('a bug in an action is reported with a reference, diagnosis, stack and redacted input', async () => {
    const staff = withRequest(await makeActor(['manager']), request);
    const contact = await ann(staff);
    const res = await callAction(buggy, { id: contact.id, password: 'hunter2' }, staff);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('internal');
    expect(res.error.ref).toMatch(/^E-/);
    expect(res.error.message).toContain(res.error.ref);

    const [report] = await getDb().select().from(errorEvents);
    expect(report).toMatchObject({
      ref: res.error.ref,
      source: 'action',
      action: 'test.buggy',
      code: 'code.null_reference',
      errorName: 'TypeError',
      actorContactId: staff.contactId,
      requestId: 'req-1',
      path: '/admin',
      input: { id: contact.id, password: '[redacted]' },
      environment: 'local',
    });
    expect(report!.stack).toContain('logging.test.ts');
    expect(report!.hint).toBeTruthy();
  });

  it('errors.get gives an AI everything needed; only owners/admins can read reports', async () => {
    const staff = withRequest(await makeActor(['manager']), request);
    const contact = await ann(staff);
    const res = await callAction(buggy, { id: contact.id }, staff);
    const ref = !res.ok ? res.error.ref! : '';

    expect(await callAction(getError, { ref }, await makeActor(['manager']))).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });

    const owner = await makeActor(['owner']);
    const got = await callAction(getError, { ref: ref.toLowerCase() }, owner);
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.data.occurrences.count).toBe(1);
    expect(got.data.relatedActivity.map((a) => a.action)).toEqual([
      'contacts.create',
      'test.buggy',
    ]);
    for (const part of [
      ref,
      'code.null_reference',
      'test.buggy',
      '## Stack',
      '"id"',
      'errors.resolve',
    ]) {
      expect(got.data.brief).toContain(part);
    }

    expect((await callAction(getError, { ref: 'E-NOPE2345' }, owner)).ok === false).toBe(true);
  });

  it('groups repeats of the same bug; resolving closes the group until it happens again', async () => {
    const staff = await makeActor(['manager']);
    const a = await ann(staff);
    const b = (
      (await callAction(createContact, { firstName: 'Bo' }, staff)) as { data: { id: string } }
    ).data;
    const first = await callAction(buggy, { id: a.id }, staff);
    await callAction(buggy, { id: b.id }, staff);

    const owner = await makeActor(['owner']);
    const open = await callAction(listErrors, {}, owner);
    expect(open.ok && open.data.map((g) => [g.count, g.openCount, g.action])).toEqual([
      [2, 2, 'test.buggy'],
    ]);

    const ref = !first.ok ? first.error.ref! : '';
    const resolved = await callAction(resolveError, { ref, resolution: 'Fixed in abc123' }, owner);
    expect(resolved).toMatchObject({ ok: true, data: { resolved: 2 } });
    expect(await callAction(listErrors, {}, owner)).toMatchObject({ ok: true, data: [] });

    await callAction(buggy, { id: a.id }, staff);
    const again = await callAction(listErrors, {}, owner);
    expect(again.ok && again.data.map((g) => [g.count, g.openCount])).toEqual([[3, 1]]);
  });

  it('expected failures (not found, conflict) are answers, not error reports', async () => {
    const staff = await makeActor(['manager']);
    const res = await callAction(updateContact, { id: crypto.randomUUID(), firstName: 'X' }, staff);
    expect(res).toMatchObject({ ok: false, error: { code: 'not_found' } });
    expect(await getDb().select().from(errorEvents)).toHaveLength(0);
  });

  it('reportError never throws and still returns a reference', async () => {
    const ref = await reportError(new Error('boom'), {
      source: 'job',
      // A value Postgres can't store must not make reporting itself fail.
      context: { bad: '\u0000' },
    });
    expect(ref).toMatch(/^E-/);
    const [saved] = await getDb().select().from(errorEvents).where(eq(errorEvents.ref, ref));
    expect(saved).toMatchObject({ message: 'boom', input: null });
  });

  it('an internal ActionError keeps its message for people and diagnoses its cause', async () => {
    const providerDown = defineAction({
      ...buggy,
      name: 'test.provider',
      async run(): Promise<never> {
        const cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:1'), {
          code: 'ECONNREFUSED',
        });
        throw new ActionError('internal', 'The payment provider is unreachable', undefined, {
          cause,
        });
      },
    });
    const staff = await makeActor(['manager']);
    const res = await callAction(providerDown, { id: crypto.randomUUID() }, staff);
    expect(res).toMatchObject({
      ok: false,
      error: {
        message: expect.stringMatching(
          /^The payment provider is unreachable\. Error reference: E-/,
        ),
      },
    });
    const [report] = await getDb().select().from(errorEvents);
    expect(report?.code).toBe('net.unreachable');
  });

  it('alerts registered handlers about a new bug, once per bug, and about spikes', async () => {
    const seen: string[] = [];
    registerErrorAlerts(async (_tx, alert) => {
      seen.push(`${alert.kind}:${alert.where}`);
    });
    const staff = await makeActor(['manager']);
    const a = await ann(staff);
    await callAction(buggy, { id: a.id }, staff);
    await callAction(buggy, { id: a.id }, staff);
    expect(seen).toEqual(['new:test.buggy']);
    for (let i = 0; i < SPIKE_THRESHOLD; i++) await callAction(buggy, { id: a.id }, staff);
    expect(seen.at(-1)).toBe('spike:test.buggy');
  });
});

describe('diagnosis', () => {
  const pgError = (code: string) =>
    Object.assign(new Error('Failed query'), { cause: Object.assign(new Error('x'), { code }) });

  it('recognises common failures through the cause chain', () => {
    expect(diagnose(pgError('42P01')).code).toBe('db.missing_table');
    expect(diagnose(pgError('42703')).code).toBe('db.missing_column');
    expect(diagnose(pgError('23503')).code).toBe('db.foreign_key');
    expect(diagnose(Object.assign(new Error('x'), { code: 'ECONNREFUSED' })).code).toBe(
      'net.unreachable',
    );
    expect(diagnose(new Error('DATABASE_URL is not set. See docs.')).code).toBe(
      'config.missing_env',
    );
    const skew = Object.assign(
      new Error(
        'Server Action "605294d2052c4ec755e3bf5c3e806be4ea5a2f3a11" was not found on the server.',
      ),
      { name: 'UnrecognizedActionError' },
    );
    expect(diagnose(skew).code).toBe('deploy.version_skew');
    expect(diagnose(new Error('weird')).code).toBe('code.unhandled');
    expect(diagnose('a string').code).toBe('code.unhandled');
  });

  it('fingerprints ignore ids, numbers, quoted values and line numbers', () => {
    const stack = (line: number) => `Error: x\n    at run (/app/packages/core/src/a.ts:${line}:5)`;
    const a = fingerprint('c', 'Error', 'Contact 0b8f…-uuid "Ann" has 3 items', stack(10));
    const b = fingerprint('c', 'Error', 'Contact 0b8f…-uuid "Bo" has 7 items', stack(12));
    expect(a).toBe(b);
    expect(fingerprint('c', 'Error', 'Different', stack(10))).not.toBe(a);
  });
});
