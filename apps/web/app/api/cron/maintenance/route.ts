import { logger, runMaintenance } from '@app/core';

import { cronRoute } from '@/lib/cron';

/** GET /api/cron/maintenance — run once a day: log retention, cleanup and the modules’ daily steps (docs/logging.md → Retention). */
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const GET = cronRoute('maintenance', async () => {
  const log = logger({ source: 'cron.maintenance' });
  const result = await runMaintenance();
  log.info('ran', { ...result });
  return result;
});
