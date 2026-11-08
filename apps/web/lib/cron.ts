import 'server-only';

import { recordCronRun, reportError } from '@app/core';

/**
 * A scheduled route: refuses anything without `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends
 * it), records the run in `cron_runs` (so /api/healthcheck and Admin → System know it is alive) and
 * reports failures with an error reference. Register the schedule on your host (vercel.json).
 */
export function cronRoute(job: string, work: () => Promise<unknown>) {
  return async function GET(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      return Response.json(await recordCronRun(job, work));
    } catch (err) {
      const ref = await reportError(err, { source: 'job', context: { job } });
      return Response.json({ error: ref }, { status: 500 });
    }
  };
}
