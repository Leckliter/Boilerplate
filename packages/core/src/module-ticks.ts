/**
 * Work that optional modules want done every minute (the cron route calls `runModuleTicks()` right
 * after `runDueJobs()`): start schedule-triggered automations, send notification deliveries whose
 * time has come (quiet hours, retry delays). A module registers its tick in its `register.ts`;
 * deleting the module removes its tick with it.
 */
export type ModuleTick = (now: Date) => Promise<unknown>;

const ticks = new Map<string, ModuleTick>();

/** Register a per-minute task. A duplicate name is a bug and throws. */
export function registerTick(name: string, fn: ModuleTick) {
  if (ticks.has(name)) throw new Error(`Duplicate module tick: ${name}`);
  ticks.set(name, fn);
}

export function listTicks(): readonly string[] {
  return [...ticks.keys()];
}

/**
 * Run every registered tick. One tick failing never stops the others; failures are returned
 * (the cron route reports them with reportError).
 */
export async function runModuleTicks(
  now = new Date(),
): Promise<{ results: Record<string, unknown>; failures: { name: string; error: unknown }[] }> {
  const results: Record<string, unknown> = {};
  const failures: { name: string; error: unknown }[] = [];
  for (const [name, fn] of ticks) {
    try {
      results[name] = await fn(now);
    } catch (error) {
      failures.push({ name, error });
    }
  }
  return { results, failures };
}
