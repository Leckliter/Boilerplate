// rules-ok: no-db-in-web — route tests seed and inspect the local test database directly
import { getDb, notifications, sql } from '@app/db';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { GET as cronJobs } from '@/app/api/cron/jobs/route';
import { GET as cronMaintenance } from '@/app/api/cron/maintenance/route';
import { GET as healthcheck } from '@/app/api/healthcheck/route';
import { GET as pushKey } from '@/app/api/push/public-key/route';
import { GET as confirmPage, POST as confirm } from '@/app/api/v1/newsletter/confirm/route';
import {
  GET as unsubscribePage,
  POST as unsubscribe,
} from '@/app/api/v1/newsletter/unsubscribe/route';
import { POST as runAction } from '@/app/api/v1/actions/[name]/route';
import { newsletterUnsubscribeUrl } from '@app/core/newsletter';

import { assertLocalDatabase, json, request, resetDatabase } from '../helpers';

beforeAll(assertLocalDatabase);
beforeEach(resetDatabase);

const secret = () => ({ authorization: `Bearer ${process.env.CRON_SECRET}` });

describe('GET /api/healthcheck', () => {
  it('is public and shallow by default', async () => {
    const res = await healthcheck(request('/api/healthcheck'));
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.checks.database.ok).toBe(true);
    expect(Object.keys(body.checks).some((k) => k.startsWith('deep/'))).toBe(false);
  });

  it('?deep=1 needs the CRON_SECRET (401 otherwise) and then also checks storage, email, sms, push and webhooks without sending', async () => {
    expect((await healthcheck(request('/api/healthcheck?deep=1'))).status).toBe(401);
    expect(
      (
        await healthcheck(
          request('/api/healthcheck?deep=1', { headers: { authorization: 'Bearer wrong' } }),
        )
      ).status,
    ).toBe(401);
    const res = await healthcheck(request('/api/healthcheck?deep=1', { headers: secret() }));
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(
      Object.keys(body.checks)
        .filter((k) => k.startsWith('deep/'))
        .sort(),
    ).toEqual(['deep/email', 'deep/push', 'deep/sms', 'deep/storage', 'deep/webhooks']);
    expect(body.checks['deep/storage'].detail).toBe('not configured');
    expect(body.checks['deep/webhooks'].detail).toContain('Resend webhook secret set');
    expect(JSON.stringify(body)).not.toContain(process.env.RESEND_WEBHOOK_SECRET);
  });

  it('?deep=1 fails (503) when a configured service is broken', async () => {
    process.env.VAPID_PUBLIC_KEY = 'broken';
    process.env.VAPID_PRIVATE_KEY = 'broken';
    process.env.VAPID_SUBJECT = 'mailto:a@b.c';
    try {
      const res = await healthcheck(request('/api/healthcheck?deep=1', { headers: secret() }));
      expect(res.status).toBe(503);
      expect((await json(res)).checks['deep/push'].ok).toBe(false);
    } finally {
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
      delete process.env.VAPID_SUBJECT;
    }
  });
});

describe('GET /api/push/public-key', () => {
  it('says push is not configured without VAPID keys; returns the public key (only) with them', async () => {
    expect(await json(await pushKey())).toEqual({ configured: false, publicKey: null });
    process.env.VAPID_PUBLIC_KEY = 'public-key-value';
    process.env.VAPID_PRIVATE_KEY = 'private-key-value';
    process.env.VAPID_SUBJECT = 'mailto:ops@example.com';
    try {
      const res = await pushKey();
      expect(await json(res)).toEqual({ configured: true, publicKey: 'public-key-value' });
      expect(JSON.stringify(await json(await pushKey()))).not.toContain('private-key-value');
    } finally {
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
      delete process.env.VAPID_SUBJECT;
    }
  });
});

describe('cron routes', () => {
  it('refuse a missing or wrong secret and run with the right one, recording the run', async () => {
    for (const route of [cronJobs, cronMaintenance]) {
      expect((await route(request('/api/cron/x'))).status).toBe(401);
      expect(
        (await route(request('/api/cron/x', { headers: { authorization: 'Bearer nope' } }))).status,
      ).toBe(401);
    }
    const jobs = await cronJobs(request('/api/cron/jobs', { headers: secret() }));
    expect(jobs.status).toBe(200);
    expect(await json(jobs)).toHaveProperty('jobs');
    const maintenance = await cronMaintenance(
      request('/api/cron/maintenance', { headers: secret() }),
    );
    expect(maintenance.status).toBe(200);
    expect((await json(maintenance)).steps).toHaveProperty('account.deletions');
  });
});

describe('newsletter email links', () => {
  const guestPost = (name: string, body: object) =>
    runAction(
      request(`/api/v1/actions/${name}`, {
        method: 'POST',
        body,
        headers: {
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
          'x-forwarded-for': '203.0.113.5',
        },
      }),
      { params: Promise.resolve({ name }) },
    );

  it('subscribe → confirmation email link → GET shows a button, POST subscribes → unsubscribe link works', async () => {
    const sub = await guestPost('newsletter.subscribe', { email: 'fan@example.com' });
    expect(sub.status).toBe(200);
    const [n] = await getDb().select().from(notifications);
    const link = new URL(n!.content.url!);
    expect(link.pathname).toBe('/api/v1/newsletter/confirm');
    const t = link.searchParams.get('t')!;

    const page = await confirmPage(request(`/api/v1/newsletter/confirm?t=${t}`));
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('<button');
    const done = await confirm(request(`/api/v1/newsletter/confirm?t=${t}`, { method: 'POST' }));
    expect(done.status).toBe(303);
    expect(new URL(done.headers.get('location')!).pathname).toBe('/newsletter/confirmed');

    const [row] = await getDb().execute<{ id: string }>(
      sql`select id from app.newsletter_subscriptions where email = 'fan@example.com'`,
    );
    const unsubUrl = new URL(newsletterUnsubscribeUrl(row!.id));
    expect((await unsubscribePage(request(unsubUrl.pathname + unsubUrl.search))).status).toBe(200);
    const out = await unsubscribe(request(unsubUrl.pathname + unsubUrl.search, { method: 'POST' }));
    expect(out.status).toBe(303);
    expect(new URL(out.headers.get('location')!).pathname).toBe('/newsletter/unsubscribed');
    // Mail apps' one-click unsubscribe (RFC 8058) gets JSON, not a redirect.
    const oneClick = await unsubscribe(
      request(unsubUrl.pathname + unsubUrl.search, {
        method: 'POST',
        body: 'List-Unsubscribe=One-Click',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      }),
    );
    expect(oneClick.status).toBe(200);
    expect(await oneClick.json()).toEqual({ ok: true });
  });

  it('a bad token is a friendly 400 page, not an error', async () => {
    const res = await confirm(
      request('/api/v1/newsletter/confirm?t=garbage-token', { method: 'POST' }),
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('isn’t valid');
    expect(
      (
        await unsubscribe(
          request('/api/v1/newsletter/unsubscribe?t=garbage-token', { method: 'POST' }),
        )
      ).status,
    ).toBe(400);
  });
});
