import { runMaintenance } from '@app/core';

import { cronRoute } from '@/lib/cron';

/** GET /api/cron/maintenance — run once a day: log retention and cleanup (docs/logging.md → Retention). */
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const GET = cronRoute('maintenance', () => runMaintenance());
