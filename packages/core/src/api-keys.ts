import { createHash, randomBytes } from 'node:crypto';

import { and, apiKeys, contactRoles, contacts, eq, getDb, gt, isNull, or } from '@app/db';

import { type Actor, apiKeyActor } from './access';

/** Rename with your app (e.g. `acme_sk_`). Keys are recognised by this prefix. */
const PREFIX = 'app_sk_';

export function generateApiKey() {
  const key = PREFIX + randomBytes(24).toString('base64url');
  return { key, prefix: key.slice(0, PREFIX.length + 4), keyHash: hashApiKey(key) };
}

export function hashApiKey(key: string) {
  return createHash('sha256').update(key).digest('hex');
}

/** Turn a bearer token into an Actor, or null if it's unknown, revoked or expired. */
export async function actorFromApiKey(
  token: string,
  channel: 'api' | 'mcp',
): Promise<Actor | null> {
  if (!token.startsWith(PREFIX)) return null;
  const db = getDb();
  const now = new Date();
  const [row] = await db
    .select({ key: apiKeys })
    .from(apiKeys)
    // Keys of archived (offboarded) contacts stop working.
    .innerJoin(contacts, and(eq(contacts.id, apiKeys.contactId), eq(contacts.status, 'active')))
    .where(
      and(
        eq(apiKeys.keyHash, hashApiKey(token)),
        isNull(apiKeys.revokedAt),
        or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, now)),
      ),
    );
  const key = row?.key;
  if (!key) return null;
  const roles = await db
    .select({ role: contactRoles.role })
    .from(contactRoles)
    .where(eq(contactRoles.contactId, key.contactId));
  // Fire-and-forget; a missed timestamp is harmless (hence the empty catch).
  void db
    .update(apiKeys)
    .set({ lastUsedAt: now })
    .where(eq(apiKeys.id, key.id))
    .catch(() => {
      // Expected to be harmless: last_used_at is a convenience, never a reason to refuse a valid key.
    });
  return apiKeyActor({
    contactId: key.contactId,
    roles: roles.map((r) => r.role),
    apiKeyId: key.id,
    keyPermissions: key.permissions,
    channel,
  });
}
