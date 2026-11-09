import type { ActionDefinition, AnyAction } from './define';

/**
 * Any defined action. `any` is deliberate: a specific action's typed `logInput`/`run` don't narrow to
 * `unknown` parameters, and the registry only needs the name, audience and schema.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DefinedAction = ActionDefinition<any, any, any>;

/**
 * The action registry's storage. It imports nothing, so action files and optional modules
 * (packages/core/src/modules.ts) can register themselves without import cycles.
 */
const byName = new Map<string, AnyAction>();

/**
 * Register actions. Names are permanent and unique: a duplicate is a bug and throws (production and
 * tests). In `next dev`, hot reload re-evaluates module files that register themselves, so there a
 * repeat registration replaces the earlier one instead of crashing every page.
 */
export function registerActions(...list: readonly DefinedAction[]) {
  for (const action of list as readonly AnyAction[]) {
    if (byName.has(action.name) && !isDevReload()) {
      throw new Error(`Duplicate action name: ${action.name}`);
    }
    byName.set(action.name, action);
  }
}

function isDevReload() {
  return process.env.NODE_ENV === 'development';
}

export function getAction(name: string): AnyAction | undefined {
  return byName.get(name);
}

export function listActions(): readonly AnyAction[] {
  return [...byName.values()];
}
