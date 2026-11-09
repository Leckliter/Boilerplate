// rules-ok: no-db-in-web — route tests seed and inspect the local test database directly
import { apiKeys, contactRoles, contacts, getDb, sql } from '@app/db';
import { generateApiKey } from '@app/core';

// rules-ok: no-db-in-web — route tests seed and inspect the local test database directly
import type { AppRole } from '@app/db';

export function assertLocalDatabase() {
  const url = process.env.DATABASE_URL ?? '';
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    throw new Error('Tests need DATABASE_URL pointing at a local Postgres (they write data).');
  }
}

/** Empty every table except the migration-seeded system tags. Call from beforeEach. */
export async function resetDatabase() {
  await getDb().execute(sql`
    truncate app.automation_steps, app.automation_runs, app.automations, app.events,
      app.notification_deliveries, app.notifications, app.notification_preferences,
      app.push_subscriptions, app.message_suppressions, app.files, app.jobs, app.cron_runs,
      app.rate_limit_hits, app.idempotency_keys, app.settings, app.integrations,
      app.activity_log, app.change_log, app.error_events, app.api_keys,
      app.contact_tags, app.contact_roles, app.contacts
    restart identity cascade`);
  await getDb().execute(sql`delete from app.tags where system = false`);
}

let n = 0;
/** A contact with these roles and an API key that acts as them (`permissions` narrows the key). */
export async function makeKey(roles: AppRole[], permissions: string[] | null = null) {
  const [c] = await getDb()
    .insert(contacts)
    .values({
      displayName: `Key owner ${++n}`,
      email: `key${n}-${Date.now()}@example.com`,
      source: 'seed',
    })
    .returning();
  if (roles.length) {
    await getDb()
      .insert(contactRoles)
      .values(roles.map((role) => ({ contactId: c!.id, role })));
  }
  const { key, prefix, keyHash } = generateApiKey();
  await getDb()
    .insert(apiKeys)
    .values({ contactId: c!.id, name: 'test key', prefix, keyHash, permissions });
  return { key, contactId: c!.id };
}

type Init = { method?: string; headers?: Record<string, string>; body?: unknown; raw?: string };

/** A Web Request to the app, as a client (or the framework) would make it. */
export function request(path: string, init: Init = {}) {
  const raw = init.raw ?? (init.body === undefined ? undefined : JSON.stringify(init.body));
  return new Request(`http://localhost:3000${path}`, {
    method: init.method ?? (raw === undefined ? 'GET' : 'POST'),
    headers: { ...(raw !== undefined && { 'content-type': 'application/json' }), ...init.headers },
    body: raw,
  });
}

export const bearer = (key: string) => ({ authorization: `Bearer ${key}` });

/** The JSON body of a response. */
export const json = async <T = Record<string, any>>(res: Response) => (await res.json()) as T; // eslint-disable-line @typescript-eslint/no-explicit-any
