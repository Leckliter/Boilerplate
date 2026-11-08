import { z } from 'zod';

import { getAppEnv, integrationStatus } from '../../env';
import { defineAction } from '../define';

export const whoami = defineAction({
  name: 'system.whoami',
  title: 'Who am I',
  description:
    'Who the caller is acting as, their roles and permissions, and which environment (production/test) this is. ' +
    'Call this first to understand what you are allowed to do.',
  audience: 'authenticated',
  mutates: false,
  returns: '{ kind, contactId, roles, permissions, channel, environment }',
  input: z.object({}),
  async run({ actor }) {
    return {
      kind: actor.kind,
      contactId: actor.contactId,
      roles: actor.roles,
      permissions: [...actor.permissions],
      channel: actor.channel,
      environment: getAppEnv(),
    };
  },
});

export const systemIntegrations = defineAction({
  name: 'system.integrations',
  title: 'Integration status',
  description:
    'Which outside services (database, sign-in, email, SMS, storage …) are configured in this environment, ' +
    'and the NAMES of the variables still missing. Never returns secret values.',
  audience: 'system.manage',
  mutates: false,
  returns: '[{ id, label, description, core, configured, missing[], invalid[] }]',
  input: z.object({}),
  async run() {
    return integrationStatus();
  },
});
