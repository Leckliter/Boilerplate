import { runDueJobs } from '@app/core';
import { runModuleTicks } from '@app/core/modules';

import { cronRoute } from '@/lib/cron';

/** GET /api/cron/jobs — run every minute: background jobs (retries, notifications, automations). */
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const GET = cronRoute('jobs', async () => {
  const jobs = await runDueJobs({ limit: 10, deadlineMs: 40_000 });
  // Module work that runs every minute: schedule-triggered automations, delayed notification sends.
  const ticks = await runModuleTicks();
  return { jobs, ticks };
});
