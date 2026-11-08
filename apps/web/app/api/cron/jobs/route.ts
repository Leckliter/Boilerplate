import { runDueJobs } from '@app/core';

import { cronRoute } from '@/lib/cron';

/** GET /api/cron/jobs — run every minute: background jobs (retries, notifications, automations). */
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const GET = cronRoute('jobs', () => runDueJobs({ limit: 10, deadlineMs: 40_000 }));
