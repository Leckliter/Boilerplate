import { z } from 'zod';

import {
  conditionSchema,
  OPERATORS,
  STEP_TYPES,
  stepSchema,
  triggerSchema,
} from '../../automations';
import { hasPermission, PERMISSIONS } from '../../access';
import { listEventTypes } from '../../events';
import { defineAction } from '../define';
import { AUDIENCE, usableInSteps } from './shared';

/** What automations can react to and do — for AIs and the editor. */

export const automationsReference = defineAction({
  name: 'automations.reference',
  title: 'Automation building blocks',
  description:
    'Everything needed to write an automation: every event (when it fires, its data fields as JSON Schema, an example), ' +
    'every step type, condition operators, trigger shapes, the template syntax, the actions YOU may use in an action step ' +
    '(with their input as JSON Schema) and the staff permissions a notifyStaff step can target. Call this before automations.create.',
  audience: AUDIENCE,
  mutates: false,
  returns:
    '{ events, stepTypes, operators, templates, actions: [{ name, title, description, mutates, destructive, input }], permissions, schemas: { trigger, step, condition } }',
  input: z.object({}),
  async run({ actor }) {
    const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: 'input', unrepresentable: 'any' });
    // Lazy: the action registry includes this file.
    const { listActions } = await import('../registry');
    const actions = listActions()
      .filter((a) => usableInSteps(a) && hasPermission(actor, a.audience))
      .filter((a) => !(actor.restricted && a.audience === 'authenticated' && a.mutates))
      .map((a) => ({
        name: a.name,
        title: a.title,
        description: a.description,
        mutates: a.mutates,
        destructive: Boolean(a.destructive),
        input: schema(a.input),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      events: listEventTypes().map((e) => ({
        type: e.type,
        description: e.description,
        subject: e.subject?.type ?? null,
        data: schema(e.data),
        example: e.example,
      })),
      stepTypes: STEP_TYPES,
      actions,
      permissions: Object.entries(PERMISSIONS).map(([name, description]) => ({
        name,
        description,
      })),
      operators: OPERATORS,
      templates:
        'Use {{path}} in step inputs, titles, bodies, match values and the concurrency key. Paths: ' +
        'event.type, event.data.<field>, event.subject.id, event.occurredAt; steps.<step id or index>.<field> ' +
        '(an action step’s output is the action’s result); run.id; automation.name; now. A value that is only ' +
        'a template keeps its type (e.g. a list). Schedule triggers have event.data.slot and event.data.at.',
      schemas: {
        trigger: schema(triggerSchema),
        step: schema(stepSchema),
        condition: schema(conditionSchema),
      },
    };
  },
});

// ------------------------------------------------------------------ automations
