import { z } from 'zod';

import { allFlags, FLAG_NAMES, type FlagName, flagSetting, ROLE_NAMES, setFlag } from '../../flags';
import { defineAction } from '../define';

export const listFlags = defineAction({
  name: 'flags.list',
  title: 'List feature flags',
  description:
    'Every feature flag the code knows, with its description, whether it was ever configured, and its current ' +
    'setting: `enabled` (the master switch), `percent` (gradual rollout, 0–100), `roles` and `contactIds` (always ' +
    'on for these). With none of percent/roles/contactIds an enabled flag is on for everyone.',
  audience: 'settings.manage',
  mutates: false,
  returns: '[{ name, description, default, configured, enabled, percent?, roles?, contactIds? }]',
  input: z.object({}),
  async run({ tx }) {
    return allFlags(tx);
  },
});

export const setFeatureFlag = defineAction({
  name: 'flags.set',
  title: 'Change a feature flag',
  description:
    'Turn a flag on/off (`enabled`) and/or change who gets it: `percent` (0–100, a stable share of people), `roles`, ' +
    '`contactIds`. Fields you leave out keep their value; pass null to clear percent / roles / contactIds. Only ' +
    'flags the code declares (flags.list) can be set. Takes up to ~10 seconds to reach every server.',
  audience: 'settings.manage',
  mutates: true,
  returns: 'The flag with its new setting',
  input: z.object({
    name: z.enum(FLAG_NAMES as [FlagName, ...FlagName[]]),
    enabled: z.boolean().optional(),
    percent: z.number().int().min(0).max(100).nullable().optional(),
    roles: z.array(z.enum(ROLE_NAMES)).nullable().optional(),
    contactIds: z.array(z.uuid()).max(500).nullable().optional(),
  }),
  async run({ input, actor, tx, log }) {
    const current = await flagSetting(tx, input.name);
    const next = {
      enabled: input.enabled ?? current.enabled,
      percent: input.percent === null ? undefined : (input.percent ?? current.percent),
      roles: input.roles === null ? undefined : (input.roles ?? current.roles),
      contactIds: input.contactIds === null ? undefined : (input.contactIds ?? current.contactIds),
    };
    const clean = Object.fromEntries(
      Object.entries(next).filter(([, v]) => v !== undefined),
    ) as typeof next;
    await setFlag(tx, input.name, clean, actor.contactId);
    log({
      subjectType: 'setting',
      summary: `Flag ${input.name}: ${clean.enabled ? 'on' : 'off'}${clean.percent !== undefined ? `, ${clean.percent}%` : ''}${clean.roles?.length ? `, roles ${clean.roles.join('/')}` : ''}`,
    });
    return { name: input.name, ...clean };
  },
});
