import { deepHealthChecks, healthReport } from '@app/core';

export const dynamic = 'force-dynamic';

/**
 * GET /api/healthcheck — for an uptime monitor. 200 when the database answers and every scheduled job
 * has run recently, 503 otherwise. Names and timings only: no secrets, no data.
 *
 * GET /api/healthcheck?deep=1 (with `Authorization: Bearer $CRON_SECRET`) also checks that file
 * storage, email (Resend), texts (Quo) and the push keys are reachable / valid, WITHOUT sending
 * anything (`deep/*` checks). Without the secret: 401 — it calls outside services, so not for the public.
 */
export async function GET(req: Request) {
  const deep = new URL(req.url).searchParams.get('deep');
  const wantsDeep = deep === '1' || deep === 'true';
  if (wantsDeep) {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  const report = await healthReport();
  if (wantsDeep) {
    const checks = await deepHealthChecks();
    Object.assign(report.checks, checks);
    report.ok = report.ok && Object.values(checks).every((c) => c.ok);
  }
  return Response.json(report, {
    status: report.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
