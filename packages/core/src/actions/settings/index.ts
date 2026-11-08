import { eq, integrations, settings } from '@app/db';
import { z } from 'zod';

import { integrationStatus } from '../../env';
import { ActionError, defineAction } from '../define';

const keyField = z
  .string()
  .regex(/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)*$/, 'dotted key like "business.name"')
  .describe('Setting key, dotted, e.g. "business.name".');

export const listSettings = defineAction({
  name: 'settings.list',
  title: 'List settings',
  description: 'Every business setting (key → JSON value). Settings are plain configuration, never secrets.',
  audience: 'settings.manage',
  mutates: false,
  returns: '[{ key, value, updatedAt }]',
  input: z.object({}),
  async run({ tx }) {
    return tx
      .select({ key: settings.key, value: settings.value, updatedAt: settings.updatedAt })
      .from(settings)
      .orderBy(settings.key);
  },
});

export const getSetting = defineAction({
  name: 'settings.get',
  title: 'Get a setting',
  description: 'One setting by key; `value` is null when it has never been set.',
  audience: 'settings.manage',
  mutates: false,
  returns: '{ key, value }',
  input: z.object({ key: keyField }),
  async run({ input, tx }) {
    const [row] = await tx.select().from(settings).where(eq(settings.key, input.key));
    return { key: input.key, value: row?.value ?? null };
  },
});

export const setSetting = defineAction({
  name: 'settings.set',
  title: 'Change a setting',
  description:
    'Create or replace one setting. The value can be any JSON. Never store secrets here — they belong in environment variables.',
  audience: 'settings.manage',
  mutates: true,
  returns: '{ key, value }',
  input: z.object({ key: keyField, value: z.json().describe('Any JSON value.') }),
  async run({ input, actor, tx, log }) {
    await tx
      .insert(settings)
      .values({ key: input.key, value: input.value, updatedByContactId: actor.contactId })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: input.value, updatedByContactId: actor.contactId },
      });
    log({ subjectType: 'setting', summary: `Changed setting ${input.key}` });
    return { key: input.key, value: input.value };
  },
});

export const listIntegrations = defineAction({
  name: 'integrations.list',
  title: 'List integrations',
  description:
    'Outside services with whether they are configured (from environment variables — names only, never values), ' +
    'and whether staff have switched them on or off (kill switch) plus their non-secret config.',
  audience: 'settings.manage',
  mutates: false,
  returns: '[{ id, label, description, core, configured, missing[], invalid[], enabled, config }]',
  input: z.object({}),
  async run({ tx }) {
    const rows = await tx.select().from(integrations);
    return integrationStatus().map((s) => {
      const row = rows.find((r) => r.key === s.id);
      return { ...s, enabled: row?.enabled ?? true, config: row?.config ?? {} };
    });
  },
});

export const updateIntegration = defineAction({
  name: 'integrations.update',
  title: 'Switch an integration on/off or change its config',
  description:
    'Kill switch and non-secret config for one integration (an id from integrations.list). Whether it is ' +
    'configured still comes from environment variables.',
  audience: 'settings.manage',
  mutates: true,
  returns: '{ id, enabled, config }',
  input: z.object({
    id: z.string().min(1).describe('Integration id, e.g. "email" or "sms".'),
    enabled: z.boolean().optional(),
    config: z.record(z.string(), z.unknown()).optional().describe('Replaces the non-secret config.'),
  }),
  async run({ input, actor, tx, log }) {
    const known = integrationStatus().some((s) => s.id === input.id);
    if (!known) {
      throw new ActionError('not_found', `No integration "${input.id}". Use integrations.list.`);
    }
    const [row] = await tx
      .insert(integrations)
      .values({
        key: input.id,
        enabled: input.enabled ?? true,
        config: input.config ?? {},
        updatedByContactId: actor.contactId,
      })
      .onConflictDoUpdate({
        target: integrations.key,
        set: {
          ...(input.enabled !== undefined && { enabled: input.enabled }),
          ...(input.config !== undefined && { config: input.config }),
          updatedByContactId: actor.contactId,
        },
      })
      .returning();
    log({
      subjectType: 'integration',
      subjectId: row!.id,
      summary: `Integration ${input.id}: ${row!.enabled ? 'on' : 'off'}`,
    });
    return { id: input.id, enabled: row!.enabled, config: row!.config };
  },
});
