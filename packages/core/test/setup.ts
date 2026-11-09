import * as schema from '@app/db';
import { contactRoles, contacts, getDb, sql } from '@app/db';

import { type Actor, userActor } from '../src/access';
import { getAction } from '../src/actions/registry';

/**
 * Tests run against a real Postgres (DATABASE_URL must point at localhost — never a hosted
 * database). test/global-setup.ts starts one and applies the migrations.
 */
export function assertLocalDatabase() {
  const url = process.env.DATABASE_URL ?? '';
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    throw new Error('Tests need DATABASE_URL pointing at a local Postgres (they write data).');
  }
}

/**
 * Tables that belong to optional modules (modules.ts). A test database built without a module has
 * no such table, so truncate only the ones that exist.
 */
const TABLES = [
  'app.automation_steps',
  'app.automation_runs',
  'app.automations',
  'app.events',
  'app.notification_deliveries',
  'app.notifications',
  'app.notification_preferences',
  'app.push_subscriptions',
  'app.message_suppressions',
  'app.files',
  'app.jobs',
  'app.cron_runs',
  'app.rate_limit_hits',
  'app.idempotency_keys',
  'app.settings',
  'app.integrations',
  'app.activity_log',
  'app.change_log',
  'app.error_events',
  'app.api_keys',
  'app.contact_tags',
  'app.contact_roles',
  'app.contacts',
];

/** Empty every table except the migration-seeded system tags. Call from beforeEach. */
export async function resetDatabase() {
  const present = await getDb().execute<{ t: string }>(
    sql`select t from (values ${sql.join(
      TABLES.map((t) => sql`(${t})`),
      sql`, `,
    )}) as v(t) where to_regclass(t) is not null`,
  );
  const list = present.map((r) => r.t).join(', ');
  await getDb().execute(sql.raw(`truncate ${list} restart identity cascade`));
  await getDb().execute(sql`delete from app.tags where system = false`);
}

export type EmittedEvent = { type: string; data: Record<string, unknown> };

/**
 * The events recorded so far (all, or one `type`), or `null` when the events module is switched
 * off. A test about something else (a webhook, a lead, an import) checks its events only when
 * they exist:
 *
 *   const emitted = await eventsIfEnabled('email.bounced');
 *   if (emitted) expect(emitted).toHaveLength(1);
 */
export async function eventsIfEnabled(type?: string): Promise<EmittedEvent[] | null> {
  const table = (schema as unknown as { events?: typeof schema.events }).events;
  if (!table || !getAction('events.list')) return null;
  const rows = await getDb().select().from(table);
  return rows
    .filter((e) => !type || e.type === type)
    .map((e) => ({ type: e.type, data: e.data as Record<string, unknown> }));
}

let n = 0;
/** Create a contact with the given roles and return an actor for them. */
export async function makeActor(roles: Actor['roles'], name = `Tester ${++n}`): Promise<Actor> {
  const [c] = await getDb()
    .insert(contacts)
    .values({ displayName: name, email: `t${n}-${Date.now()}@example.com`, source: 'seed' })
    .returning();
  if (roles.length) {
    await getDb()
      .insert(contactRoles)
      .values(roles.map((role) => ({ contactId: c!.id, role })));
  }
  return userActor({ contactId: c!.id, roles });
}

/** Run `check` on the events of a type (all when omitted) only when the events module is on. */
export async function ifEventsEnabled(
  type: string | undefined,
  check: (events: EmittedEvent[]) => void,
) {
  const emitted = await eventsIfEnabled(type);
  if (emitted) check(emitted);
}
