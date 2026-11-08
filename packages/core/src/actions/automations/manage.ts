import {
  and,
  automationRuns,
  automations,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  max,
  or,
  sql,
} from '@app/db';
import { z } from 'zod';

import { cancelRun, definitionSchema } from '../../automations';
import { ActionError, defineAction } from '../define';
import { AUDIENCE, view, automationOrThrow, checkDefinition, columns } from './shared';

/** List, read, create, update and archive automations. */

export const listAutomations = defineAction({
  name: 'automations.list',
  title: 'List automations',
  description:
    'All automations with their tags and trigger, whether they are on, how many runs are going and when one last ran. ' +
    'Filter by tag (exact, case-insensitive) or search the name and description.',
  audience: AUDIENCE,
  mutates: false,
  returns:
    '[{ id, name, description, tags, enabled, trigger, steps, version, activeRuns, failedRuns30d, lastRunAt, … }]',
  input: z.object({
    includeArchived: z.boolean().default(false),
    tag: z.string().trim().min(1).max(40).optional().describe('Only automations with this tag'),
    search: z.string().trim().max(100).optional().describe('Words in the name or description'),
  }),
  async run({ input, tx }) {
    const tagMatch = input.tag
      ? sql`exists (select 1 from unnest(${automations.tags}) t where lower(t) = lower(${input.tag}))`
      : undefined;
    const searchMatch = input.search
      ? or(
          ilike(automations.name, `%${escapeLike(input.search)}%`),
          ilike(automations.description, `%${escapeLike(input.search)}%`),
        )
      : undefined;
    const rows = await tx
      .select()
      .from(automations)
      .where(
        and(
          input.includeArchived ? undefined : isNull(automations.archivedAt),
          tagMatch,
          searchMatch,
        ),
      )
      .orderBy(automations.name);
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const since = new Date(Date.now() - 30 * 86_400_000);
    const stats = await tx
      .select({
        automationId: automationRuns.automationId,
        status: automationRuns.status,
        n: count(),
        last: max(automationRuns.createdAt),
      })
      .from(automationRuns)
      .where(and(inArray(automationRuns.automationId, ids), gt(automationRuns.createdAt, since)))
      .groupBy(automationRuns.automationId, automationRuns.status);
    return rows.map((a) => {
      const mine = stats.filter((s) => s.automationId === a.id);
      const n = (statuses: string[]) =>
        mine.filter((s) => statuses.includes(s.status)).reduce((t, s) => t + Number(s.n), 0);
      const last =
        mine
          .map((s) => s.last)
          .filter(Boolean)
          .sort()
          .at(-1) ?? null;
      return {
        ...view(a),
        activeRuns: n(['running', 'waiting']),
        runs30d: n(['running', 'waiting', 'completed', 'failed', 'cancelled', 'skipped']),
        failedRuns30d: n(['failed']),
        lastRunAt: last,
      };
    });
  },
});

export const getAutomation = defineAction({
  name: 'automations.get',
  title: 'Get an automation',
  description:
    'One automation in full (trigger, conditions, steps, cancel rules) and its 25 most recent runs.',
  audience: AUDIENCE,
  mutates: false,
  returns:
    '{ automation, runs: [{ id, status, triggerKey, currentStep, note, error, createdAt, finishedAt }] }',
  input: z.object({ id: z.uuid() }),
  async run({ input, tx }) {
    const automation = await automationOrThrow(tx, input.id);
    const runs = await tx
      .select({
        id: automationRuns.id,
        status: automationRuns.status,
        triggerKey: automationRuns.triggerKey,
        trigger: automationRuns.trigger,
        currentStep: automationRuns.currentStep,
        wakeAt: automationRuns.wakeAt,
        waitingEvent: automationRuns.waitingEvent,
        note: automationRuns.note,
        error: automationRuns.error,
        automationVersion: automationRuns.automationVersion,
        createdAt: automationRuns.createdAt,
        finishedAt: automationRuns.finishedAt,
      })
      .from(automationRuns)
      .where(eq(automationRuns.automationId, automation.id))
      .orderBy(desc(automationRuns.createdAt))
      .limit(25);
    return { automation: view(automation), runs };
  },
});

const definitionInput = definitionSchema;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export const listAutomationTags = defineAction({
  name: 'automations.tags',
  title: 'List automation tags',
  description: 'Every tag used on an automation that isn’t archived, with how many use it.',
  audience: AUDIENCE,
  mutates: false,
  returns: '[{ tag, count }]',
  input: z.object({}),
  async run({ tx }) {
    const rows = await tx
      .select({ tags: automations.tags })
      .from(automations)
      .where(isNull(automations.archivedAt));
    const counts = new Map<string, { tag: string; count: number }>();
    for (const r of rows) {
      for (const tag of r.tags) {
        const k = tag.toLowerCase();
        const c = counts.get(k) ?? { tag, count: 0 };
        c.count++;
        counts.set(k, c);
      }
    }
    return [...counts.values()].sort((a, b) => a.tag.localeCompare(b.tag));
  },
});

export const createAutomation = defineAction({
  name: 'automations.create',
  title: 'Create an automation',
  description:
    'Create an automation: a trigger (an event like contact.created, or a schedule), optional conditions, steps (run an action, ' +
    'wait, wait for an event, check a condition, message staff or a customer, call a webhook) and optional cancelOn rules. ' +
    'It starts OFF unless enabled=true; use automations.run to test it first. Call automations.reference for the event list, ' +
    'step shapes and template syntax. Every action used must be one you may run yourself.',
  audience: AUDIENCE,
  mutates: true,
  returns: 'The automation',
  input: z.object({
    definition: definitionInput,
    enabled: z.boolean().default(false),
  }),
  async run({ input, actor, tx, log }) {
    await checkDefinition(input.definition, actor);
    const [a] = await tx
      .insert(automations)
      .values({
        ...columns(input.definition),
        enabled: input.enabled,
        createdByContactId: actor.contactId,
        updatedByContactId: actor.contactId,
      })
      .returning();
    log({
      subjectType: 'automation',
      subjectId: a!.id,
      summary: `Created automation “${a!.name}”${a!.enabled ? ' (on)' : ''}`,
    });
    return view(a!);
  },
});

export const updateAutomation = defineAction({
  name: 'automations.update',
  title: 'Edit an automation',
  description:
    'Replace an automation’s definition and/or turn it on or off. Runs already going keep the steps they started with; ' +
    'new runs use the new version. Send the whole definition (get it with automations.get, change it, send it back).',
  audience: AUDIENCE,
  mutates: true,
  returns: 'The automation',
  input: z
    .object({
      id: z.uuid(),
      definition: definitionInput.optional(),
      enabled: z.boolean().optional(),
    })
    .refine((v) => v.definition || v.enabled !== undefined, 'Send a definition, enabled, or both.'),
  async run({ input, actor, tx, log }) {
    const current = await automationOrThrow(tx, input.id);
    if (current.archivedAt) throw new ActionError('conflict', 'That automation is archived.');
    if (input.definition) await checkDefinition(input.definition, actor);
    const [a] = await tx
      .update(automations)
      .set({
        ...(input.definition && { ...columns(input.definition), version: current.version + 1 }),
        ...(input.enabled !== undefined && { enabled: input.enabled }),
        updatedByContactId: actor.contactId,
      })
      .where(eq(automations.id, current.id))
      .returning();
    const what = [
      input.definition && `edited (v${a!.version})`,
      input.enabled !== undefined &&
        input.enabled !== current.enabled &&
        (a!.enabled ? 'turned on' : 'turned off'),
    ].filter(Boolean);
    log({
      subjectType: 'automation',
      subjectId: a!.id,
      summary: `Automation “${a!.name}” ${what.join(', ') || 'saved'}`,
    });
    return view(a!);
  },
});

export const archiveAutomation = defineAction({
  name: 'automations.archive',
  title: 'Archive an automation',
  description:
    'Turn an automation off for good and hide it from the list. Runs still going are cancelled. Its history is kept.',
  audience: AUDIENCE,
  mutates: true,
  destructive: true,
  returns: '{ id, cancelledRuns }',
  input: z.object({ id: z.uuid() }),
  async run({ input, tx, log }) {
    const a = await automationOrThrow(tx, input.id);
    await tx
      .update(automations)
      .set({ enabled: false, archivedAt: a.archivedAt ?? new Date() })
      .where(eq(automations.id, a.id));
    const active = await tx
      .select({ id: automationRuns.id })
      .from(automationRuns)
      .where(
        and(
          eq(automationRuns.automationId, a.id),
          inArray(automationRuns.status, ['running', 'waiting']),
        ),
      );
    let cancelledRuns = 0;
    for (const r of active) {
      if (await cancelRun(tx, r.id, 'Automation archived')) cancelledRuns++;
    }
    log({
      subjectType: 'automation',
      subjectId: a.id,
      summary: `Archived automation “${a.name}”${cancelledRuns ? ` (${cancelledRuns} runs cancelled)` : ''}`,
    });
    return { id: a.id, cancelledRuns };
  },
});

export const duplicateAutomation = defineAction({
  name: 'automations.duplicate',
  title: 'Duplicate an automation',
  description:
    'Copy an automation (trigger, conditions, steps, tags) as a new one named “Copy of …”. The copy starts OFF and has no runs.',
  audience: AUDIENCE,
  mutates: true,
  returns: 'The new automation',
  input: z.object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(120).optional().describe('Default: “Copy of <name>”'),
  }),
  async run({ input, actor, tx, log }) {
    const source = await automationOrThrow(tx, input.id);
    const { name: _old, ...rest } = view(source);
    const definition = definitionSchema.parse({
      name: input.name ?? `Copy of ${source.name}`.slice(0, 120),
      description: rest.description,
      tags: rest.tags,
      trigger: rest.trigger,
      conditions: rest.conditions,
      steps: rest.steps,
      cancelOn: rest.cancelOn,
      concurrencyKey: rest.concurrencyKey,
    });
    // The copy is the copier's: they must be allowed every action in it.
    await checkDefinition(definition, actor);
    const [a] = await tx
      .insert(automations)
      .values({
        ...columns(definition),
        enabled: false,
        createdByContactId: actor.contactId,
        updatedByContactId: actor.contactId,
      })
      .returning();
    log({
      subjectType: 'automation',
      subjectId: a!.id,
      summary: `Duplicated automation “${source.name}” as “${a!.name}”`,
    });
    return view(a!);
  },
});
