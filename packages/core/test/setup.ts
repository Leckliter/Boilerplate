import { contactRoles, contacts, getDb, sql } from '@app/db';

import { type Actor, userActor } from '../src/access';

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
