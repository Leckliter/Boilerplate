import {
  and,
  automationRuns,
  automations,
  automationSteps,
  eq,
  events,
  getDb,
  jobs,
  notifications,
} from '@app/db';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { guestActor, type Actor } from '../src/access';
import { addContactTags, callAction, createContact, getContact } from '../src/actions';
import {
  archiveAutomation,
  automationsReference,
  cancelRunAction,
  createAutomation,
  duplicateAutomation,
  getAutomation,
  getRun,
  listAutomations,
  listAutomationTags,
  listRuns,
  retryRunAction,
  runAutomation,
  updateAutomation,
} from '../src/actions/automations';
import { dispatchEvent } from '../src/automations';
import { flattenSteps, stepSchema, walkSteps } from '../src/automations/definition';
import { startScheduledAutomations } from '../src/automations/runs';
import { dueSlot } from '../src/automations/schedule';
import { render } from '../src/automations/template';
import { runDueJobs } from '../src/jobs';
import { assertLocalDatabase, makeActor, resetDatabase } from './setup';

beforeAll(assertLocalDatabase);
beforeEach(resetDatabase);

async function ok<T>(p: Promise<{ ok: boolean } & Record<string, unknown>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(JSON.stringify((r as unknown as { error: unknown }).error));
  return (r as unknown as { data: T }).data;
}

/** Make an owner, an automation, and run all background work to the end. */
async function setup(definition: Record<string, unknown>, enabled = true) {
  const owner = await makeActor(['owner']);
  const a = await ok<{ id: string }>(
    callAction(createAutomation, { definition, enabled } as never, owner),
  );
  return { owner, id: a.id };
}
const drain = async () => {
  for (let i = 0; i < 5; i++) await runDueJobs();
};
const runs = () => getDb().select().from(automationRuns);

describe('templates and schedules', () => {
  it('renders {{paths}} and keeps the type of a whole-value template', () => {
    const ctx = { event: { data: { n: 3, list: [1, 2], name: 'Ann' } } };
    expect(render('Hi {{event.data.name}}!', ctx)).toBe('Hi Ann!');
    expect(render('{{event.data.n}}', ctx)).toBe(3);
    expect(render({ a: ['{{event.data.list}}'] }, ctx)).toEqual({ a: [[1, 2]] });
  });

  it('finds the due slot of every-N-minutes and daily schedules in the app time zone', () => {
    const t = new Date('2026-01-15T14:30:30Z'); // 08:30 in America/Chicago (CST)
    expect(dueSlot({ type: 'schedule', everyMinutes: 15 }, t)).toMatch(/^every:15:/);
    expect(dueSlot({ type: 'schedule', dailyAt: '08:30' }, t)).toBe('daily:2026-01-15');
    expect(dueSlot({ type: 'schedule', dailyAt: '09:00' }, t)).toBeNull();
    expect(dueSlot({ type: 'schedule', dailyAt: '08:30', weekdays: [6, 7] }, t)).toBeNull();
  });
});

describe('branch steps: `thenSteps`, with the legacy `then` key still read', () => {
  // Built with a computed key: that is how old stored JSON looks, and lint forbids a literal `then`.
  const LEGACY = ['th', 'en'].join('');
  const check = { type: 'condition', conditions: [{ path: 'event.type', op: 'exists' }] };
  const legacy = {
    type: 'branch',
    conditions: [{ path: 'event.data.x', op: 'exists' }],
    [LEGACY]: [
      { ...check, id: 'yes' },
      { type: 'branch', conditions: check.conditions, [LEGACY]: [{ ...check, id: 'deep' }] },
    ],
    else: [{ ...check, id: 'no' }],
  };

  it('renames a stored `then` to `thenSteps`, at every depth', () => {
    const step = stepSchema.parse(legacy) as unknown as Record<string, unknown>;
    expect(step).not.toHaveProperty('then');
    const yes = step.thenSteps as Record<string, unknown>[];
    expect(yes.map((s) => s.id ?? s.type)).toEqual(['yes', 'branch']);
    expect(yes[1]).not.toHaveProperty('then');
    expect((yes[1]!.thenSteps as unknown[]).length).toBe(1);
  });

  it('prefers `thenSteps` when both are given', () => {
    const step = stepSchema.parse({
      ...legacy,
      thenSteps: [{ ...check, id: 'new' }],
    }) as unknown as {
      thenSteps: { id: string }[];
    };
    expect(step.thenSteps.map((s) => s.id)).toEqual(['new']);
  });

  it('flattens and walks a definition read raw from the database (no parse)', () => {
    const raw = [legacy] as never;
    const flat = flattenSteps(raw);
    expect(flat.map((s) => ('id' in s && s.id) || s.type)).toEqual([
      'branch',
      'yes',
      'branch',
      'deep',
      'no',
    ]);
    expect(flat[0]).not.toHaveProperty('then');
    const seen: string[] = [];
    walkSteps(raw, (s) => seen.push(('id' in s && s.id) || s.type));
    expect(seen).toEqual(['branch', 'yes', 'branch', 'deep', 'no']);
  });
});

describe('automations.* management', () => {
  const def = {
    name: 'Tag new leads',
    tags: ['onboarding'],
    trigger: { type: 'event', event: 'contact.created' },
    steps: [{ type: 'wait', for: '1h' }],
  };

  it('creates, lists, gets, edits, duplicates and archives', async () => {
    const { owner, id } = await setup(def, false);
    const list = await ok<{ id: string; enabled: boolean }[]>(
      callAction(listAutomations, { tag: 'ONBOARDING' }, owner),
    );
    expect(list).toMatchObject([{ id, enabled: false }]);
    expect(await ok<unknown[]>(callAction(listAutomationTags, {}, owner))).toEqual([
      { tag: 'onboarding', count: 1 },
    ]);
    const got = await ok<{ automation: { version: number }; runs: unknown[] }>(
      callAction(getAutomation, { id }, owner),
    );
    expect(got.automation.version).toBe(1);
    const updated = await ok<{ version: number; enabled: boolean }>(
      callAction(
        updateAutomation,
        { id, enabled: true, definition: { ...def, name: 'Renamed' } } as never,
        owner,
      ),
    );
    expect(updated).toMatchObject({ version: 2, enabled: true });
    const copy = await ok<{ id: string; name: string; enabled: boolean }>(
      callAction(duplicateAutomation, { id }, owner),
    );
    expect(copy).toMatchObject({ name: 'Copy of Renamed', enabled: false });
    await ok(callAction(archiveAutomation, { id: copy.id }, owner));
    expect(await ok<unknown[]>(callAction(listAutomations, {}, owner))).toHaveLength(1);
    const ref = await ok<{ events: unknown[]; actions: { name: string }[] }>(
      callAction(automationsReference, {}, owner),
    );
    expect(ref.events.length).toBeGreaterThan(5);
    expect(ref.actions.map((a) => a.name)).toContain('contacts.addTags');
    expect(ref.actions.map((a) => a.name)).not.toContain('automations.create');
  });

  it('refuses the wrong people and bad definitions', async () => {
    const owner = await makeActor(['owner']);
    for (const who of [
      await makeActor(['manager']),
      await makeActor([]),
      guestActor(),
    ] as Actor[]) {
      expect(await callAction(createAutomation, { definition: def } as never, who)).toMatchObject({
        ok: false,
      });
    }
    const bad = (d: object) =>
      callAction(createAutomation, { definition: { ...def, ...d } } as never, owner);
    expect(await bad({ trigger: { type: 'event', event: 'nope.nothing' } })).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
    expect(
      await bad({ steps: [{ type: 'action', action: 'automations.create', input: {} }] }),
    ).toMatchObject({ ok: false });
    expect(
      await bad({ steps: [{ type: 'action', action: 'events.recordSignIn', input: {} }] }),
    ).toMatchObject({ ok: false });
    expect(await bad({ steps: [] })).toMatchObject({ ok: false, error: { code: 'invalid_input' } });
  });
});

describe('running automations', () => {
  it('starts a run from an event, runs an action step as the system, and finishes', async () => {
    const { owner, id } = await setup({
      name: 'Tag leads',
      trigger: { type: 'event', event: 'contact.created' },
      conditions: [{ path: 'event.data.tags', op: 'contains', value: 'lead' }],
      steps: [
        {
          id: 'tagit',
          type: 'action',
          action: 'contacts.addTags',
          input: { id: '{{event.data.contactId}}', tags: ['customer'] },
        },
      ],
    });
    const c = await ok<{ id: string }>(
      callAction(createContact, { firstName: 'Ann', tags: ['lead'] }, owner),
    );
    await callAction(createContact, { firstName: 'Bo', tags: ['customer'] }, owner); // condition fails
    await drain();
    const all = await runs();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ automationId: id, status: 'completed' });
    const after = await ok<{ tags: { slug: string }[] }>(
      callAction(getContact, { id: c.id }, owner),
    );
    expect(after.tags.map((t) => t.slug).sort()).toEqual(['customer', 'lead']);
    const got = await ok<{ steps: { status: string }[] }>(
      callAction(getRun, { id: all[0]!.id }, owner),
    );
    expect(got.steps[0]!.status).toBe('done');
    expect(await ok<unknown[]>(callAction(listRuns, { automationId: id }, owner))).toHaveLength(1);
  });

  it('dispatching the same event twice starts one run (exactly once)', async () => {
    const { owner } = await setup({
      name: 'Once',
      trigger: { type: 'event', event: 'contact.created' },
      steps: [{ type: 'condition', conditions: [{ path: 'event.type', op: 'exists' }] }],
    });
    await callAction(createContact, { firstName: 'Ann' }, owner);
    const [ev] = await getDb().select().from(events).where(eq(events.type, 'contact.created'));
    await Promise.all([dispatchEvent(ev!.id), dispatchEvent(ev!.id)]);
    await dispatchEvent(ev!.id);
    expect(await runs()).toHaveLength(1);
  });

  it('waits, then resumes; branches pick one arm', async () => {
    const { owner } = await setup({
      name: 'Wait and branch',
      trigger: { type: 'event', event: 'contact.created' },
      steps: [
        { type: 'wait', for: '1h' },
        {
          type: 'branch',
          conditions: [{ path: 'event.data.firstName', op: 'equals', value: 'x' }],
          thenSteps: [
            { id: 'yes', type: 'condition', conditions: [{ path: 'event.type', op: 'exists' }] },
          ],
          else: [
            { id: 'no', type: 'condition', conditions: [{ path: 'event.type', op: 'exists' }] },
          ],
        },
      ],
    });
    await callAction(createContact, { firstName: 'Ann' }, owner);
    await drain();
    expect((await runs())[0]).toMatchObject({ status: 'waiting' });
    await getDb()
      .update(automationRuns)
      .set({ wakeAt: new Date(Date.now() - 1000) });
    await getDb()
      .update(automationSteps)
      .set({ output: { until: new Date(Date.now() - 1000).toISOString() } });
    await getDb()
      .update(jobs)
      .set({ runAt: new Date(Date.now() - 1000) });
    await drain();
    const [run] = await runs();
    expect(run).toMatchObject({ status: 'completed' });
    const steps = await getDb()
      .select()
      .from(automationSteps)
      .where(eq(automationSteps.runId, run!.id));
    expect(steps.map((s) => s.type).sort()).toEqual(['branch', 'condition', 'wait']);
  });

  it('waitForEvent resumes on the matching event; cancelOn stops a run', async () => {
    const { owner } = await setup({
      name: 'Waiter',
      trigger: { type: 'event', event: 'contact.created' },
      cancelOn: [
        {
          event: 'contact.archived',
          match: { field: 'data.contactId', equals: '{{event.data.contactId}}' },
        },
      ],
      steps: [
        {
          id: 'w',
          type: 'waitForEvent',
          event: 'contact.tagged',
          match: { field: 'data.contactId', equals: '{{event.data.contactId}}' },
          timeout: '1d',
        },
      ],
    });
    const a = await ok<{ id: string }>(callAction(createContact, { firstName: 'Ann' }, owner));
    const b = await ok<{ id: string }>(callAction(createContact, { firstName: 'Bo' }, owner));
    await drain();
    expect((await runs()).map((r) => r.status)).toEqual(['waiting', 'waiting']);
    await callAction(addContactTags, { id: a.id, tags: ['customer'] }, owner);
    const { archiveContact } = await import('../src/actions');
    await callAction(archiveContact, { id: b.id }, owner);
    await drain();
    const byStatus = (await runs()).map((r) => r.status).sort();
    expect(byStatus).toEqual(['cancelled', 'completed']);
  });

  it('message steps notify through notify() once, and manual runs / cancel / retry work', async () => {
    const { owner, id } = await setup(
      {
        name: 'Tell staff',
        trigger: { type: 'event', event: 'contact.created' },
        steps: [
          {
            type: 'notifyStaff',
            permission: 'automations.manage',
            title: 'New: {{event.data.displayName}}',
            body: 'Look at them.',
          },
        ],
      },
      false,
    );
    const started = await ok<{ status: string }>(callAction(runAutomation, { id }, owner));
    expect(started.status).toBe('started');
    await drain();
    await drain();
    const inbox = await getDb()
      .select()
      .from(notifications)
      .where(eq(notifications.type, 'staff.automationMessage'));
    expect(inbox).toHaveLength(1);
    expect(inbox[0]!.content.title).toBe('New: Pat Example');
    const [run] = await runs();
    expect(run!.status).toBe('completed');
    // Completed runs can be neither cancelled nor retried.
    expect(await callAction(cancelRunAction, { id: run!.id }, owner)).toMatchObject({
      ok: false,
      error: { code: 'conflict' },
    });
    expect(await callAction(retryRunAction, { id: run!.id }, owner)).toMatchObject({
      ok: false,
      error: { code: 'conflict' },
    });
  });

  it('a failing step fails the run and tells automations.manage; retry resumes there', async () => {
    const { owner, id } = await setup({
      name: 'Breaks',
      trigger: { type: 'event', event: 'contact.created' },
      steps: [
        {
          type: 'action',
          action: 'contacts.get',
          input: { id: '00000000-0000-4000-8000-0000000000aa' },
        },
      ],
    });
    await callAction(createContact, { firstName: 'Ann' }, owner);
    await drain();
    const [run] = await runs();
    expect(run).toMatchObject({ status: 'failed' });
    expect(run!.error).toContain('contacts.get');
    expect(
      (
        await getDb()
          .select()
          .from(notifications)
          .where(eq(notifications.type, 'staff.automationFailed'))
      ).length,
    ).toBe(1);
    expect(
      (await getDb().select().from(events).where(eq(events.type, 'automation.failed'))).length,
    ).toBe(1);
    // An automation never starts from its own failure.
    expect((await runs()).length).toBe(1);
    expect(await callAction(retryRunAction, { id: run!.id }, owner)).toMatchObject({ ok: true });
    await drain();
    expect(
      (
        await getDb()
          .select()
          .from(automationRuns)
          .where(and(eq(automationRuns.id, run!.id)))
      )[0]!.status,
    ).toBe('failed');
    void id;
  });

  it('a waiting run can be cancelled by staff', async () => {
    const { owner, id } = await setup(
      {
        name: 'Long wait',
        trigger: { type: 'event', event: 'contact.created' },
        steps: [{ type: 'wait', for: '1w' }],
      },
      false,
    );
    await callAction(runAutomation, { id }, owner);
    await drain();
    const [run] = await runs();
    expect(run!.status).toBe('waiting');
    expect(await callAction(cancelRunAction, { id: run!.id }, owner)).toMatchObject({
      ok: true,
      data: { status: 'cancelled' },
    });
    expect((await runs())[0]!.status).toBe('cancelled');
  });

  it('schedule automations start once per slot', async () => {
    await setup({
      name: 'Every 5',
      trigger: { type: 'schedule', everyMinutes: 5 },
      steps: [{ type: 'wait', for: '1h' }],
    });
    const now = new Date();
    expect(await startScheduledAutomations(now)).toBe(1);
    expect(await startScheduledAutomations(now)).toBe(0);
    expect(await getDb().select().from(automations)).toHaveLength(1);
  });
});
