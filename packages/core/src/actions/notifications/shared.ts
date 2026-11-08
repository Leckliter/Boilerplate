/** Helpers shared by the notification actions. */

import { z } from 'zod';

import { type Actor, hasPermission } from '../../access';
import { NOTIFICATION_TYPES } from '../../notifications/registry';
import { ActionError } from '../define';

export const channelField = z.enum(['email', 'sms', 'push']);

export function me(actor: Actor): string {
  if (!actor.contactId) throw new ActionError('unauthenticated', 'Sign in to do this.');
  return actor.contactId;
}

/** Types this person can receive (customer types for everyone; staff types for those who hold the permission). */
export function visibleTypes(actor: Actor) {
  return NOTIFICATION_TYPES.filter(
    (t) =>
      t.key !== 'system.test' &&
      (t.audience === 'customer' || (t.permission && hasPermission(actor, t.permission))),
  );
}
