import { cronRuns, getDb } from '@app/db';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { getAppEnv, getSiteUrl, integrationStatus, serverEnvProblems } from '../src/env';
import { CRONS, cronHealth, healthReport, isStale } from '../src/health';
import { assertLocalDatabase, resetDatabase } from './setup';

beforeAll(assertLocalDatabase);
beforeEach(resetDatabase);

describe('env catalogue', () => {
  it('reports missing variable NAMES only, never values', () => {
    const status = integrationStatus({
      DATABASE_URL: 'postgres://u:secret-password@h/db',
      RESEND_API_KEY: 're_secret',
    });
    expect(status.find((s) => s.id === 'database')).toMatchObject({
      configured: true,
      missing: [],
    });
    expect(status.find((s) => s.id === 'email')).toMatchObject({
      configured: false,
      missing: ['EMAIL_FROM'],
    });
    expect(JSON.stringify(status)).not.toContain('secret');
  });

  it('either auth provider satisfies sign-in; malformed values are flagged', () => {
    const neon = integrationStatus({
      NEON_AUTH_BASE_URL: 'https://x.test',
      NEON_AUTH_COOKIE_SECRET: 'x'.repeat(40),
    });
    expect(neon.find((s) => s.id === 'auth')?.configured).toBe(true);
    const supa = integrationStatus({
      NEXT_PUBLIC_SUPABASE_URL: 'https://x.test',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k',
    });
    expect(supa.find((s) => s.id === 'auth')?.configured).toBe(true);
    expect(integrationStatus({ CRON_SECRET: 'short' }).find((s) => s.id === 'cron')).toMatchObject({
      configured: false,
      invalid: ['CRON_SECRET'],
    });
    expect(serverEnvProblems({ DATABASE_URL: 'mysql://nope' })[0]).toContain('DATABASE_URL');
  });

  it('knows its environment and site URL', () => {
    expect(getAppEnv()).toBe('local');
    expect(getSiteUrl()).toMatch(/^https?:\/\//);
  });
});

describe('health', () => {
  it('a cron that has never run is unknown, an old OK run is stale', async () => {
    expect(isStale(CRONS.jobs!, null)).toBe(false);
    const report = await healthReport();
    expect(report).toMatchObject({ ok: true, checks: { database: { ok: true } } });
    expect(report.checks['cron/jobs']).toMatchObject({ ok: true, detail: 'not run here yet' });

    const old = new Date(Date.now() - 3 * 86_400_000);
    await getDb()
      .insert(cronRuns)
      .values({ job: 'jobs', startedAt: old, finishedAt: old, ok: true });
    const stale = await healthReport();
    expect(stale.ok).toBe(false);
    expect((await cronHealth()).find((c) => c.job === 'jobs')?.stale).toBe(true);
  });
});
