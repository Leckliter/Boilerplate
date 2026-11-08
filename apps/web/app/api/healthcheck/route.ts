import { healthReport } from '@app/core';

export const dynamic = 'force-dynamic';

/**
 * GET /api/healthcheck — for an uptime monitor. 200 when the database answers and every scheduled job
 * has run recently, 503 otherwise. Names and timings only: no secrets, no data.
 */
export async function GET() {
  const report = await healthReport();
  return Response.json(report, {
    status: report.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
