import { logger, reportError, runDueJobs } from '@app/core';
import { runModuleTicks } from '@app/core/modules';

import { cronRoute } from '@/lib/cron';

/** GET /api/cron/jobs — run every minute: background jobs (retries, notifications, automations). */
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const GET = cronRoute('jobs', async () => {
  const log = logger({ source: 'cron.jobs' });
  const jobs = await runDueJobs({ limit: 10, deadlineMs: 40_000 });
  // Module work that runs every minute: schedule-triggered automations, delayed notification sends.
  const ticks = await runModuleTicks();
  for (const f of ticks.failures) {
    const ref = await reportError(f.error, { source: 'job', context: { tick: f.name } });
    log.error('tick failed', { tick: f.name, ref });
  }
  log.info('ran', { jobs, ticks: Object.keys(ticks.results), failures: ticks.failures.length });
  return { jobs, ticks: ticks.results, failed: ticks.failures.map((f) => f.name) };
});
