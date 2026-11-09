// ---------------------------------------------------------------- push
/** Browser push subscriptions: subscribe, unsubscribe, status (docs/notifications.md → Push). */

import { and, desc, eq, pushSubscriptions } from '@app/db';
import { z } from 'zod';

import { pushPublicKey } from '../../notifications/push-sender';
import { defineAction } from '../define';
import { me } from '../notifications/shared';

const endpointField = z
  .url({ protocol: /^https$/, message: 'A push endpoint is an https:// URL.' })
  .max(2_000);

export const subscribePush = defineAction({
  name: 'push.subscribe',
  title: 'Turn on push on this device',
  description:
    'Save this browser’s Web Push subscription (the object `pushManager.subscribe()` returns: `endpoint` and ' +
    '`keys.p256dh` / `keys.auth`) so notifications can reach it. Needs the VAPID public key from push.status. ' +
    'Subscribing the same endpoint again just refreshes it; an endpoint that belonged to someone else on a shared ' +
    'device moves to the person now signed in.',
  audience: 'authenticated',
  mutates: true,
  rateLimit: { limit: 30, perSeconds: 60 * 60 },
  logInput: (i) => ({ endpoint: new URL(i.endpoint).host, label: i.label }),
  returns: '{ id, endpoint, label }',
  input: z.object({
    endpoint: endpointField,
    keys: z.object({
      p256dh: z.string().min(10).max(200),
      auth: z.string().min(8).max(100),
    }),
    label: z.string().trim().max(100).optional().describe('e.g. "Chrome on Android".'),
  }),
  async run({ input, actor, tx, log }) {
    const contactId = me(actor);
    const [row] = await tx
      .insert(pushSubscriptions)
      .values({
        contactId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        label: input.label ?? null,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          contactId,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          ...(input.label !== undefined && { label: input.label }),
        },
      })
      .returning();
    log({
      subjectType: 'contact',
      subjectId: contactId,
      summary: `Turned on push notifications${input.label ? ` on ${input.label}` : ''}`,
    });
    return { id: row!.id, endpoint: row!.endpoint, label: row!.label };
  },
});

export const unsubscribePush = defineAction({
  name: 'push.unsubscribe',
  title: 'Turn off push on this device',
  description:
    'Forget one of your own push subscriptions by its `endpoint`. Removing one that is not there is fine. ' +
    '(Also call `subscription.unsubscribe()` in the browser.)',
  audience: 'authenticated',
  mutates: true,
  destructive: true,
  logInput: (i) => ({ endpoint: new URL(i.endpoint).host }),
  returns: '{ removed: number }',
  input: z.object({ endpoint: endpointField }),
  async run({ input, actor, tx, log }) {
    const contactId = me(actor);
    const removed = await tx
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.endpoint, input.endpoint),
          eq(pushSubscriptions.contactId, contactId),
        ),
      )
      .returning({ id: pushSubscriptions.id });
    if (removed.length) {
      log({
        subjectType: 'contact',
        subjectId: contactId,
        summary: 'Turned off push notifications on a device',
      });
    }
    return { removed: removed.length };
  },
});

export const pushStatus = defineAction({
  name: 'push.status',
  title: 'Push status',
  description:
    'Is Web Push set up on this server (`configured`), the VAPID `publicKey` the browser subscribes with, and the ' +
    'signed-in person’s subscribed devices. Call it before offering a "Turn on notifications" button.',
  audience: 'authenticated',
  mutates: false,
  returns:
    '{ configured, publicKey, subscriptions: [{ id, label, endpointHost, createdAt, lastSuccessAt }] }',
  input: z.object({}),
  async run({ actor, tx }) {
    const rows = await tx
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.contactId, me(actor)))
      .orderBy(desc(pushSubscriptions.createdAt));
    const publicKey = pushPublicKey();
    return {
      configured: publicKey !== null,
      publicKey,
      subscriptions: rows.map((s) => ({
        id: s.id,
        label: s.label,
        endpointHost: new URL(s.endpoint).host,
        createdAt: s.createdAt,
        lastSuccessAt: s.lastSuccessAt,
      })),
    };
  },
});
