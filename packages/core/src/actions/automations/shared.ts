import { type Automation, automations, eq, type Tx } from '@app/db';
import { z } from 'zod';

import { type Actor, hasPermission } from '../../access';
import { type Definition, walkSteps } from '../../automations';
import { getEventType } from '../../events';
import { ActionError } from '../define';

/** Helpers shared by the automation actions. */

export const AUDIENCE = 'automations.manage' as const;

/** Actions an automation step may never run (a nested automation would skip the permission check). */
const NOT_IN_STEPS = /^automations\./;

/** May an automation step run this action at all (before the editor's own permissions)? */
export function usableInSteps(action: { name: string; audience: string }) {
  return action.audience !== 'system' && !NOT_IN_STEPS.test(action.name);
}

export const runStatus = z.enum([
  'running',
  'waiting',
  'completed',
  'failed',
  'cancelled',
  'skipped',
]);

export function view(a: Automation) {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    tags: a.tags,
    enabled: a.enabled,
    trigger: a.trigger as Definition['trigger'],
    conditions: a.conditions as Definition['conditions'],
    steps: a.steps as Definition['steps'],
    cancelOn: a.cancelOn as Definition['cancelOn'],
    concurrencyKey: a.concurrencyKey,
    version: a.version,
    archivedAt: a.archivedAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}
export type AutomationView = ReturnType<typeof view>;

export async function automationOrThrow(tx: Tx, id: string) {
  const [a] = await tx.select().from(automations).where(eq(automations.id, id));
  if (!a) throw new ActionError('not_found', 'No such automation.');
  return a;
}

/** Checks the schema can't: events and actions exist, and the editor may use every action. */
export async function checkDefinition(def: Definition, actor: Actor) {
  const problems: string[] = [];
  const known = (type: string, where: string) => {
    if (!getEventType(type))
      problems.push(`${where}: there is no event “${type}” (see automations.reference).`);
  };
  if (def.trigger.type === 'event') known(def.trigger.event, 'Trigger');
  def.cancelOn.forEach((c, i) => known(c.event, `Cancel rule ${i + 1}`));
  // Lazy: the action registry includes this file.
  const { getAction } = await import('../registry');
  walkSteps(def.steps, (step, where) => {
    if (step.type === 'waitForEvent') known(step.event, where);
    if (step.type !== 'action') return;
    const action = getAction(step.action);
    if (!action) {
      problems.push(`${where}: there is no action “${step.action}”.`);
      return;
    }
    if (!usableInSteps(action)) {
      problems.push(`${where}: ${step.action} can’t be used in an automation.`);
      return;
    }
    // An automation can never do more than the person (or narrowed API key) who wrote it.
    const restrictedChange =
      actor.restricted && action.audience === 'authenticated' && action.mutates;
    if (restrictedChange || !hasPermission(actor, action.audience)) {
      problems.push(`${where}: you don’t have permission for ${step.action} (${action.audience}).`);
    }
  });
  if (problems.length) throw new ActionError('invalid_input', problems.join('\n'));
}

export function columns(def: Definition) {
  return {
    name: def.name,
    description: def.description ?? null,
    tags: def.tags,
    trigger: def.trigger,
    triggerEvent: def.trigger.type === 'event' ? def.trigger.event : null,
    conditions: def.conditions,
    steps: def.steps,
    cancelOn: def.cancelOn,
    concurrencyKey: def.concurrencyKey ?? null,
  };
}
