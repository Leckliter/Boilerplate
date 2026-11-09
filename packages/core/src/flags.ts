import { createHash } from 'node:crypto';

import { eq, getDb, settings, type Tx } from '@app/db';
import { z } from 'zod';

import type { Actor } from './access';
import { ROLE_PERMISSIONS } from './access/permissions';

/**
 * FEATURE FLAGS: ship code switched off, turn it on for some people, then everyone — without a
 * deploy. Each flag is a setting `flags.<name>` (so Admin → Settings, `settings.*` and the
 * activity log already cover it) holding a `FlagSetting`. THE list of flags the code knows is
 * `FLAGS` below; add yours there (the name becomes a typed argument of `isEnabled`).
 *
 *   if (await isEnabled('beta-dashboard', viewer.actor)) …
 *
 * Rules, in order — the first that matches wins:
 *  1. `enabled: false`  → off for everyone (the kill switch).
 *  2. the person's contact id is in `contactIds`, or one of their roles is in `roles` → on.
 *  3. `percent` set → on for that share of people: a stable hash of flag + contact id, so a
 *     person's answer never flips between requests and rollouts only ever GROW (50% → 80%
 *     keeps everyone who had it). Signed-out visitors only get 100%.
 *  4. none of `roles` / `contactIds` / `percent` set → on for everyone.
 *  5. otherwise → off.
 */
export const FLAGS = {
  'beta-dashboard': {
    description:
      'The redesigned admin dashboard (sample flag: rolled out to owners/admins and half of everyone).',
    default: false,
  },
  'new-checkout': {
    description: 'The new checkout flow (sample flag: off until you are ready).',
    default: false,
  },
  'holiday-banner': {
    description: 'Show the holiday banner on the website (sample flag).',
    default: false,
  },
} as const satisfies Record<string, { description: string; default: boolean }>;

export type FlagName = keyof typeof FLAGS;
export const FLAG_NAMES = Object.keys(FLAGS) as FlagName[];

export const ROLE_NAMES = Object.keys(ROLE_PERMISSIONS) as [string, ...string[]];

export const flagSettingSchema = z.object({
  enabled: z.boolean(),
  percent: z.number().int().min(0).max(100).optional(),
  roles: z.array(z.enum(ROLE_NAMES)).optional(),
  contactIds: z.array(z.uuid()).max(500).optional(),
});
export type FlagSetting = z.infer<typeof flagSettingSchema>;

export const flagKey = (name: string) => `flags.${name}`;

/** Who a flag is evaluated for. An `Actor` fits; so does `{ contactId, roles }`. */
export type FlagSubject = Pick<Actor, 'contactId' | 'roles'>;

/** 0–99, always the same for the same flag + person. */
export function rolloutBucket(flag: string, contactId: string): number {
  const digest = createHash('sha256').update(`${flag}:${contactId}`).digest();
  return digest.readUInt32BE(0) % 100;
}

/** Pure evaluation of one flag's setting (see the rules above). */
export function evaluateFlag(
  flag: string,
  setting: FlagSetting,
  who?: FlagSubject | null,
): boolean {
  if (!setting.enabled) return false;
  if (who?.contactId && setting.contactIds?.includes(who.contactId)) return true;
  if (who && setting.roles?.some((r) => who.roles.includes(r as never))) return true;
  if (setting.percent !== undefined) {
    if (setting.percent >= 100) return true;
    if (!who?.contactId) return false;
    return rolloutBucket(flag, who.contactId) < setting.percent;
  }
  return !(setting.roles?.length || setting.contactIds?.length);
}

/** The stored setting, else the flag's default (on/off for everyone). */
export function settingOf(name: FlagName, stored: unknown): FlagSetting {
  const parsed = flagSettingSchema.safeParse(stored);
  return parsed.success ? parsed.data : { enabled: FLAGS[name].default };
}

// Flags are read on almost every request: keep the answer for a few seconds per server.
const CACHE_MS = 10_000;
let cache: { at: number; rows: Map<string, unknown> } | null = null;
export function clearFlagCache() {
  cache = null;
}

async function storedFlags(read?: Tx): Promise<Map<string, unknown>> {
  if (!read && cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const rows = await (read ?? getDb()).select().from(settings);
  const map = new Map(rows.filter((r) => r.key.startsWith('flags.')).map((r) => [r.key, r.value]));
  if (!read) cache = { at: Date.now(), rows: map };
  return map;
}

/**
 * Is this flag on for this person (omit `who` for a signed-out visitor)? Pages and route
 * handlers call it. Inside an action pass the transaction you were given: `isEnabled(flag, actor, tx)`
 * (never getDb() there). Cached for ~10 s per server, so a change takes a moment to spread.
 */
export async function isEnabled(
  name: FlagName,
  who?: FlagSubject | null,
  tx?: Tx,
): Promise<boolean> {
  const rows = await storedFlags(tx);
  return evaluateFlag(name, settingOf(name, rows.get(flagKey(name))), who);
}

/** Every flag the code knows, each with its current setting (what flags.list returns). */
export async function allFlags(tx: Tx) {
  const rows = await storedFlags(tx);
  return FLAG_NAMES.map((name) => ({
    name,
    description: FLAGS[name].description,
    default: FLAGS[name].default,
    configured: rows.has(flagKey(name)),
    ...settingOf(name, rows.get(flagKey(name))),
  }));
}

export async function setFlag(tx: Tx, name: FlagName, value: FlagSetting, by: string | null) {
  await tx
    .insert(settings)
    .values({ key: flagKey(name), value, updatedByContactId: by })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedByContactId: by } });
  clearFlagCache();
}

export async function flagSetting(tx: Tx, name: FlagName) {
  const [row] = await tx
    .select()
    .from(settings)
    .where(eq(settings.key, flagKey(name)));
  return settingOf(name, row?.value);
}
