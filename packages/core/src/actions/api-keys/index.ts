import { and, apiKeys, desc, eq } from '@app/db';
import { z } from 'zod';

import { PERMISSIONS, type Permission } from '../../access';
import { generateApiKey } from '../../api-keys';
import { emit } from '../../events/emit';
import { ActionError, defineAction } from '../define';

const publicColumns = {
  id: apiKeys.id,
  name: apiKeys.name,
  prefix: apiKeys.prefix,
  permissions: apiKeys.permissions,
  lastUsedAt: apiKeys.lastUsedAt,
  expiresAt: apiKeys.expiresAt,
  revokedAt: apiKeys.revokedAt,
  createdAt: apiKeys.createdAt,
};

export const listApiKeys = defineAction({
  name: 'apiKeys.list',
  title: 'List my API keys',
  description: 'Your own API keys (the secret itself is never shown again after creation).',
  audience: 'api_keys.manage',
  mutates: false,
  returns: 'ApiKey[] (without secrets)',
  input: z.object({}),
  async run({ actor, tx }) {
    return tx
      .select(publicColumns)
      .from(apiKeys)
      .where(eq(apiKeys.contactId, actor.contactId!))
      .orderBy(desc(apiKeys.createdAt));
  },
});

export const createApiKey = defineAction({
  name: 'apiKeys.create',
  title: 'Create API key',
  description:
    'Create a key for the REST API or the MCP server (for AI assistants like Claude). The key acts as YOU, ' +
    'optionally limited to some of your permissions. The secret is returned ONCE — store it safely.',
  audience: 'api_keys.manage',
  mutates: true,
  returns: '{ key (secret, shown once), apiKey }',
  input: z.object({
    name: z.string().trim().min(1).max(80).describe('What it is for, e.g. "Claude desktop".'),
    permissions: z
      .array(z.enum(Object.keys(PERMISSIONS) as [Permission, ...Permission[]]))
      .optional()
      .describe('Limit the key to these permissions. Omit for all of your permissions.'),
    expiresInDays: z.number().int().min(1).max(365).optional(),
  }),
  async run({ input, actor, tx, log }) {
    if (!actor.contactId) throw new ActionError('forbidden', 'Only people can own API keys.');
    if (actor.kind === 'api_key')
      throw new ActionError('forbidden', 'API keys cannot create other API keys.');
    const { key, prefix, keyHash } = generateApiKey();
    const [row] = await tx
      .insert(apiKeys)
      .values({
        contactId: actor.contactId,
        name: input.name,
        prefix,
        keyHash,
        permissions: input.permissions ?? null,
        expiresAt: input.expiresInDays
          ? new Date(Date.now() + input.expiresInDays * 86_400_000)
          : null,
      })
      .returning(publicColumns);
    await emit(tx, 'api_key.created', {
      contactId: actor.contactId,
      apiKeyId: row!.id,
      name: input.name,
      restricted: input.permissions !== undefined,
    });
    log({ subjectType: 'api_key', subjectId: row!.id, summary: `Created API key "${input.name}"` });
    return { key, apiKey: row! };
  },
});

export const revokeApiKey = defineAction({
  name: 'apiKeys.revoke',
  title: 'Revoke API key',
  description:
    'Permanently disable one of your API keys. Anything using it stops working immediately.',
  audience: 'api_keys.manage',
  mutates: true,
  destructive: true,
  returns: '{ id }',
  input: z.object({ id: z.uuid() }),
  async run({ input, actor, tx, log }) {
    const [row] = await tx
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, input.id), eq(apiKeys.contactId, actor.contactId!)))
      .returning({ id: apiKeys.id, name: apiKeys.name });
    if (!row) throw new ActionError('not_found', 'No such key on your account.');
    log({ subjectType: 'api_key', subjectId: row.id, summary: `Revoked API key "${row.name}"` });
    return { id: row.id };
  },
});
