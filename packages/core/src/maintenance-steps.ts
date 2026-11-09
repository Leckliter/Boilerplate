/**
 * Daily housekeeping that optional modules want done (`runMaintenance()` runs every registered step
 * after its own cleanup): e.g. anonymising accounts whose deletion grace period is over. Register
 * in the module's `register.ts`; deleting the module removes its step with it.
 */
export type MaintenanceStep = (now: Date) => Promise<unknown>;

const steps = new Map<string, MaintenanceStep>();

/** Register a daily step. A duplicate name is a bug and throws. */
export function registerMaintenanceStep(name: string, fn: MaintenanceStep) {
  if (steps.has(name)) throw new Error(`Duplicate maintenance step: ${name}`);
  steps.set(name, fn);
}

export function listMaintenanceSteps(): readonly [string, MaintenanceStep][] {
  return [...steps];
}
