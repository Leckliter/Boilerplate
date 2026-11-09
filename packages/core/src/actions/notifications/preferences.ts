// ---------------------------------------------------------------- preferences
/** What each person wants to hear about, and how — including SMS consent and one-click unsubscribe. */

import {
  type AppRole,
  and,
  contactRoles,
  contacts,
  desc,
  eq,
  messageSuppressions,
  notificationPreferences,
  or,
  pushSubscriptions,
  type Tx,
} from '@app/db';
import { z } from 'zod';

import { type Actor, hasPermission, userActor } from '../../access';
import { CHANNELS } from '../../notifications/base';
import { smsConsentText } from '../../notifications/consent';
import { getNotificationType, NOTIFICATION_TYPES } from '../../notifications/registry';
import { verifyUnsubscribe } from '../../notifications/tokens';
import { phoneField } from '../contacts/shared';
import { ActionError, defineAction } from '../define';
import { channelField, me, visibleTypes } from './shared';

/** One person's notification settings as that person would see them (`actor` decides which staff types are listed). */
export async function preferencesView(tx: Tx, contactId: string, actor: Actor) {
  const [contact] = await tx.select().from(contacts).where(eq(contacts.id, contactId));
  if (!contact) throw new ActionError('not_found', 'No such contact.');
  const prefs = await tx
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.contactId, contactId));
  const suppressions = await tx
    .select()
    .from(messageSuppressions)
    .where(
      or(
        contact.email
          ? and(
              eq(messageSuppressions.channel, 'email'),
              eq(messageSuppressions.address, contact.email),
            )
          : undefined,
        contact.phone
          ? and(
              eq(messageSuppressions.channel, 'sms'),
              eq(messageSuppressions.address, contact.phone),
            )
          : undefined,
      ),
    );
  const devices = await tx
    .select({
      id: pushSubscriptions.id,
      label: pushSubscriptions.label,
      createdAt: pushSubscriptions.createdAt,
      lastSuccessAt: pushSubscriptions.lastSuccessAt,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.contactId, contactId))
    .orderBy(desc(pushSubscriptions.createdAt));
  return {
    types: visibleTypes(actor).map((t) => ({
      key: t.key,
      audience: t.audience,
      label: t.label,
      description: t.description,
      required: Boolean(t.required),
      channels: Object.fromEntries(
        CHANNELS.map((c) => [
          c,
          {
            enabled:
              (c === 'email' && Boolean(t.required)) ||
              (prefs.find((p) => p.type === t.key && p.channel === c)?.enabled ?? t.defaults[c]),
            locked: c === 'email' && Boolean(t.required),
          },
        ]),
      ) as Record<(typeof CHANNELS)[number], { enabled: boolean; locked: boolean }>,
    })),
    email: {
      address: contact.email,
      suppressed: suppressions.find((s) => s.channel === 'email')?.reason ?? null,
    },
    sms: {
      phone: contact.phone,
      consentAt: contact.smsConsentAt,
      consentSource: contact.smsConsentSource,
      stopped: suppressions.some((s) => s.channel === 'sms'),
    },
    devices,
    smsConsentText: smsConsentText(),
  };
}

export const getPreferences = defineAction({
  name: 'notifications.preferences',
  title: 'My notification settings',
  description:
    'What the signed-in person is notified about and how: per type, which of email / SMS / push are on (and which ' +
    'can’t be turned off), plus their email and texting status and the devices that get push notifications.',
  audience: 'authenticated',
  mutates: false,
  returns: '{ types, email, sms, devices, smsConsentText }',
  input: z.object({}),
  async run({ actor, tx }) {
    return preferencesView(tx, me(actor), actor);
  },
});

export const setPreference = defineAction({
  name: 'notifications.setPreference',
  title: 'Change a notification setting',
  description:
    'Turn one channel (email, sms, push) on or off for one notification type, for the signed-in person. ' +
    'Email for required types (receipts, security) can’t be turned off. Turning SMS on does nothing until ' +
    'the person has agreed to texts (notifications.setSmsConsent).',
  audience: 'authenticated',
  mutates: true,
  returns: '{ type, channel, enabled }',
  input: z.object({ type: z.string(), channel: channelField, enabled: z.boolean() }),
  async run({ input, actor, tx, log }) {
    const contactId = me(actor);
    const type = visibleTypes(actor).find((t) => t.key === input.type);
    if (!type) throw new ActionError('not_found', `No notification type "${input.type}" for you.`);
    if (type.required && input.channel === 'email' && !input.enabled) {
      throw new ActionError('conflict', `${type.label} are always emailed.`);
    }
    await tx
      .insert(notificationPreferences)
      .values({ contactId, type: type.key, channel: input.channel, enabled: input.enabled })
      .onConflictDoUpdate({
        target: [
          notificationPreferences.contactId,
          notificationPreferences.type,
          notificationPreferences.channel,
        ],
        set: { enabled: input.enabled },
      });
    log({
      subjectType: 'contact',
      subjectId: contactId,
      summary: `${input.enabled ? 'Turned on' : 'Turned off'} ${input.channel} for “${type.label}”`,
    });
    return { type: type.key, channel: input.channel, enabled: input.enabled };
  },
});

export const setSmsConsent = defineAction({
  name: 'notifications.setSmsConsent',
  title: 'Text message consent',
  description:
    'Record that a person agreed (consent=true) or no longer agrees (consent=false) to automated texts. ' +
    'Without it nobody is ever texted. For yourself: optionally also set your mobile number. For someone else ' +
    '(they agreed in person or on the phone): needs users.manage and is recorded as given to staff. ' +
    'The exact wording agreed to is stored with the consent.',
  audience: 'authenticated',
  mutates: true,
  returns: '{ consentAt, phone }',
  input: z.object({
    contactId: z.uuid().optional().describe('Someone else (staff only). Omit for yourself.'),
    consent: z.boolean(),
    phone: phoneField.optional().describe('Set this mobile number at the same time.'),
  }),
  async run({ input, actor, tx, log }) {
    const self = !input.contactId || input.contactId === actor.contactId;
    if (!self && !hasPermission(actor, 'users.manage')) {
      throw new ActionError('forbidden', 'Only staff can record consent for someone else.');
    }
    const contactId = self ? me(actor) : input.contactId!;
    const [contact] = await tx
      .select()
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .for('update');
    if (!contact) throw new ActionError('not_found', 'No such contact.');
    const phone = input.phone ?? contact.phone;
    if (input.consent && !phone) {
      throw new ActionError('invalid_input', 'Add a mobile number first.');
    }
    const source = self ? (actor.channel === 'web' ? 'account' : actor.channel) : 'staff';
    const consentAt = input.consent ? new Date() : null;
    await tx
      .update(contacts)
      .set({
        phone,
        smsConsentAt: consentAt,
        smsConsentSource: input.consent ? source : null,
        smsConsentText: input.consent ? smsConsentText() : null,
      })
      .where(eq(contacts.id, contactId));
    if (input.consent && phone) {
      // Asking again after replying STOP is a fresh opt-in.
      await tx
        .delete(messageSuppressions)
        .where(and(eq(messageSuppressions.channel, 'sms'), eq(messageSuppressions.address, phone)));
    }
    log({
      subjectType: 'contact',
      subjectId: contactId,
      summary: `${input.consent ? 'Agreed to' : 'Stopped'} text messages${phone ? ` at ${phone}` : ''}${self ? '' : ' (recorded by staff)'}`,
    });
    return { consentAt, phone };
  },
});

export const unsubscribe = defineAction({
  name: 'notifications.unsubscribe',
  title: 'Unsubscribe from an email',
  description:
    'Public: turn off emails of one notification type using the signed token from the email’s unsubscribe link.',
  audience: 'public',
  rateLimit: { limit: 30, perSeconds: 60 * 60 },
  mutates: true,
  logInput: () => ({ token: '[redacted]' }),
  returns: '{ label }',
  input: z.object({ token: z.string().max(500) }),
  async run({ input, tx, log }) {
    const payload = verifyUnsubscribe(input.token);
    const type = payload && getNotificationType(payload.t);
    if (!payload || !type) {
      throw new ActionError('invalid_input', 'That unsubscribe link isn’t valid.');
    }
    if (type.required) {
      throw new ActionError('conflict', `${type.label} are always emailed.`);
    }
    const [contact] = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.id, payload.c));
    if (!contact) throw new ActionError('not_found', 'That unsubscribe link isn’t valid.');
    await tx
      .insert(notificationPreferences)
      .values({ contactId: contact.id, type: type.key, channel: 'email', enabled: false })
      .onConflictDoUpdate({
        target: [
          notificationPreferences.contactId,
          notificationPreferences.type,
          notificationPreferences.channel,
        ],
        set: { enabled: false },
      });
    log({
      subjectType: 'contact',
      subjectId: contact.id,
      summary: `Unsubscribed from “${type.label}” emails`,
    });
    return { label: type.label };
  },
});

export const preferencesFor = defineAction({
  name: 'notifications.preferencesFor',
  title: 'Someone’s notification settings',
  description:
    'Read-only: what one person is notified about and through which channels (the same shape as ' +
    'notifications.preferences, as that person sees it), their email and texting status and how many devices get ' +
    'push. Staff use it to see how a user can be reached; the person’s own switches can only be changed by them.',
  audience: 'notifications.manage',
  mutates: false,
  returns: '{ types, email, sms, devices, smsConsentText }',
  input: z.object({ contactId: z.uuid() }),
  async run({ input, tx }) {
    const [contact] = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.id, input.contactId));
    if (!contact) throw new ActionError('not_found', 'No such contact.');
    const roles = await tx
      .select({ role: contactRoles.role })
      .from(contactRoles)
      .where(eq(contactRoles.contactId, contact.id));
    const as = userActor({ contactId: contact.id, roles: roles.map((r) => r.role as AppRole) });
    return preferencesView(tx, contact.id, as);
  },
});

export const typeDefaults = defineAction({
  name: 'notifications.typeDefaults',
  title: 'Notification types and their defaults',
  description:
    'The catalogue of everything the app can notify about: for each type its key, label, who it is for ' +
    '(customers or staff, and the permission staff need), whether email is required, whether it is urgent or ' +
    'hidden from people’s settings, and which of email / SMS / push are on by default. Defaults apply until a ' +
    'person changes their own settings.',
  audience: 'notifications.manage',
  mutates: false,
  returns:
    '[{ key, label, description, audience, permission, required, urgent, hidden, defaults: { email, sms, push } }]',
  input: z.object({ audience: z.enum(['customer', 'staff']).optional() }),
  async run({ input }) {
    return NOTIFICATION_TYPES.filter((t) => !input.audience || t.audience === input.audience).map(
      (t) => ({
        key: t.key,
        label: t.label,
        description: t.description,
        audience: t.audience,
        permission: ('permission' in t ? t.permission : null) ?? null,
        required: Boolean('required' in t && t.required),
        urgent: Boolean('urgent' in t && t.urgent),
        hidden: Boolean('hidden' in t && t.hidden),
        defaults: t.defaults,
      }),
    );
  },
});
