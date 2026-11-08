import { and, count, type Db, desc, eq, getDb, jobs, cronRuns, sql, type Tx } from '@app/db';

import { getAppEnv } from './env';

/**
 * Health: is the database answering, and are the scheduled jobs (crons) still running?
 *
 * Every cron route wraps its work in `recordCronRun(job, …)`, which writes a `cron_runs` row
 * (started, finished, ok / error, a small summary). A cron is STALE when its newest OK run is
 * older than twice its interval plus five minutes. Stale crons make GET /api/healthcheck
 * return 503 (so an outside uptime monitor alerts — the only thing that notices when ALL
 * crons stopped) and show a warning in Admin → System.
 *
 * A job that has never run is "unknown", not stale: preview and test deploys often have no
 * cron scheduler at all.
 *
 * Add your own cron: add it to `CRONS`, create the route, call `recordCronRun`.
 */
export const CRONS = {
  jobs: { everySeconds: 60, label: 'Background jobs' },
  maintenance: { everySeconds: 24 * 60 * 60, label: 'Daily cleanup' },
} as Record<string, { everySeconds: number; label: string }>;

const SLACK_MS = 5 * 60_000;

export function isStale(
  cron: { everySeconds: number },
  lastOkAt: Date | null,
  now = new Date(),
): boolean {
  if (!lastOkAt) return false;
  return now.getTime() - lastOkAt.getTime() > cron.everySeconds * 2_000 + SLACK_MS;
}

/**
 * Run a cron's work and record it in `cron_runs`. The error (if any) is recorded and re-thrown,
 * so the caller still reports it. The `summary` is whatever `work` returns (keep it small).
 */
export async function recordCronRun<T>(job: string, work: () => Promise<T>): Promise<T> {
  const [run] = await getDb().insert(cronRuns).values({ job }).returning({ id: cronRuns.id });
  const started = Date.now();
  try {
    const result = await work();
    await getDb()
      .update(cronRuns)
      .set({ finishedAt: new Date(), ok: true, summary: (result ?? {}) as object })
      .where(eq(cronRuns.id, run!.id));
    return result;
  } catch (err) {
    // Best-effort note on the run; the original error is rethrown below either way.
    await getDb()
      .update(cronRuns)
      .set({
        finishedAt: new Date(),
        ok: false,
        error: `${String((err as Error)?.message ?? err).slice(0, 1_000)} (after ${Date.now() - started} ms)`,
      })
      .where(eq(cronRuns.id, run!.id))
      .catch((e) => console.error(`[cron ${job}] could not record failure`, e));
    throw err;
  }
}

export type CronHealth = {
  job: string;
  label: string;
  everySeconds: number;
  lastStartedAt: Date | null;
  lastOkAt: Date | null;
  lastErrorAt: Date | null;
  lastError: string | null;
  lastSummary: unknown;
  stale: boolean;
};

/** Per-cron freshness, from the newest `cron_runs` rows. */
export async function cronHealth(db: Db | Tx = getDb(), now = new Date()): Promise<CronHealth[]> {
  const out: CronHealth[] = [];
  for (const [job, def] of Object.entries(CRONS)) {
    const [lastRun] = await db
      .select()
      .from(cronRuns)
      .where(eq(cronRuns.job, job))
      .orderBy(desc(cronRuns.startedAt))
      .limit(1);
    const [lastOk] = await db
      .select()
      .from(cronRuns)
      .where(and(eq(cronRuns.job, job), eq(cronRuns.ok, true)))
      .orderBy(desc(cronRuns.finishedAt))
      .limit(1);
    const [lastFail] = await db
      .select()
      .from(cronRuns)
      .where(and(eq(cronRuns.job, job), eq(cronRuns.ok, false)))
      .orderBy(desc(cronRuns.finishedAt))
      .limit(1);
    out.push({
      job,
      label: def.label,
      everySeconds: def.everySeconds,
      lastStartedAt: lastRun?.startedAt ?? null,
      lastOkAt: lastOk?.finishedAt ?? null,
      lastErrorAt: lastFail?.finishedAt ?? null,
      lastError: lastFail?.error ?? null,
      lastSummary: lastOk?.summary ?? null,
      stale: isStale(def, lastOk?.finishedAt ?? null, now),
    });
  }
  return out;
}

/** Stale crons only — cheap enough for an Admin layout banner. */
export async function staleCrons(now = new Date()) {
  return (await cronHealth(getDb(), now)).filter((c) => c.stale);
}

type HealthCheck = { ok: boolean; detail?: string };

export type HealthReport = {
  ok: boolean;
  environment: string;
  commit: string | null;
  checkedAt: string;
  checks: Record<string, HealthCheck>;
};

/**
 * The public health report for /api/healthcheck: one pass/fail per check, no secrets or
 * internals. `ok` is false (→ HTTP 503) when the database is down or a cron has stopped.
 */
export async function healthReport(
  now = new Date(),
  /** Inside an action, its transaction: on serverless a second query through getDb() could wait forever. */
  db: Db | Tx = getDb(),
): Promise<HealthReport> {
  const checks: Record<string, HealthCheck> = {};
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    checks.database = { ok: true, detail: `${Date.now() - started} ms` };
  } catch {
    // Expected: this IS the check — a database that doesn't answer is reported as failing.
    checks.database = { ok: false, detail: 'not answering' };
  }
  if (checks.database.ok) {
    for (const c of await cronHealth(db, now)) {
      checks[`cron/${c.job}`] = !c.lastOkAt
        ? { ok: true, detail: 'not run here yet' }
        : { ok: !c.stale, detail: `last OK ${c.lastOkAt.toISOString()}` };
    }
  }
  return {
    ok: Object.values(checks).every((c) => c.ok),
    environment: getAppEnv(),
    commit:
      (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? '').slice(0, 7) || null,
    checkedAt: now.toISOString(),
    checks,
  };
}

/** Background job queue sizes by status, for Admin → System. */
export async function queueStats(db: Db | Tx = getDb()) {
  const rows = await db.select({ status: jobs.status, n: count() }).from(jobs).groupBy(jobs.status);
  return { jobs: Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number> };
}
