// ---------------------------------------------------------------- webhooks
/**
 * What the provider webhooks DO once the route has verified the signature and parsed the body
 * (`/api/webhooks/resend`, `/api/webhooks/quo`). They are system-only actions so the work gets
 * the usual transaction, activity-log row and events; the route handlers only do transport.
 * Replays are harmless: every write is idempotent and every event is recorded once per provider
 * event id (`emit(..., { dedupeKey })`).
 */

import {
  and,
  contacts,
  eq,
  inArray,
  messageSuppressions,
  notificationDeliveries,
  sql,
  type Tx,
} from '@app/db';
import { z } from 'zod';

import { emit } from '../../events/emit';
import { suppressAddress } from '../../notifications/suppress';
import { ActionError, defineAction } from '../define';
import { toE164 } from '../contacts/shared';

const payload = z.object({
  eventId: z
    .string()
    .min(1)
    .max(200)
    .describe('The provider’s event/delivery id (the dedupe key).'),
  type: z.string().min(1).max(100),
  data: z.record(z.string(), z.unknown()),
});

// ---------------------------------------------------------------- Resend

const resendData = z
  .object({
    email_id: z.string().optional(),
    to: z.array(z.string()).optional(),
    bounce: z
      .object({
        type: z.string().optional(),
        subType: z.string().optional(),
        message: z.string().optional(),
      })
      .optional(),
    failed: z.object({ reason: z.string().optional() }).optional(),
  })
  .loose();

async function contactIdForEmail(tx: Tx, email: string): Promise<string | null> {
  const [c] = await tx.select({ id: contacts.id }).from(contacts).where(eq(contacts.email, email));
  return c?.id ?? null;
}

export const resendWebhook = defineAction({
  name: 'webhooks.resendEvent',
  title: 'Handle a Resend webhook',
  description:
    'System only: apply one verified Resend event. `email.delivered` marks the delivery delivered; `email.bounced` ' +
    '(a permanent bounce suppresses the address) and `email.complained` (always suppresses) mark it failed / flagged ' +
    'and emit `email.bounced`; `email.failed` marks the delivery failed. Other types are acknowledged and ignored. ' +
    'Safe to repeat.',
  audience: 'system',
  mutates: true,
  logOnlyWhenChanged: true,
  returns: '{ handled: boolean, type }',
  input: payload,
  async run({ input, tx, log }) {
    const parsed = resendData.safeParse(input.data);
    if (!parsed.success) throw new ActionError('invalid_input', 'Unreadable Resend event data.');
    const d = parsed.data;
    const emailId = d.email_id ?? '';
    const recipients = (d.to ?? []).map((a) => a.trim().toLowerCase()).filter(Boolean);
    const mark = (set: Partial<typeof notificationDeliveries.$inferInsert>, from: string[]) =>
      emailId
        ? tx
            .update(notificationDeliveries)
            .set(set)
            .where(
              and(
                eq(notificationDeliveries.providerId, emailId),
                eq(notificationDeliveries.channel, 'email'),
                inArray(notificationDeliveries.status, from as never),
              ),
            )
        : Promise.resolve();

    switch (input.type) {
      case 'email.delivered':
        await mark({ status: 'delivered', deliveredAt: new Date() }, ['sent']);
        return { handled: true, type: input.type };
      case 'email.failed':
        await mark(
          {
            status: 'failed',
            lastError: `Provider failed it: ${d.failed?.reason ?? 'unknown reason'}`.slice(0, 500),
          },
          ['sent', 'delivered'],
        );
        return { handled: true, type: input.type };
      case 'email.bounced':
      case 'email.complained': {
        const complaint = input.type === 'email.complained';
        const permanent = complaint || (d.bounce?.type ?? '').toLowerCase() === 'permanent';
        const reason = complaint
          ? 'Marked as spam'
          : (d.bounce?.message ?? d.bounce?.subType ?? null);
        if (!complaint) {
          await mark(
            {
              status: 'failed',
              lastError: `Bounced: ${reason ?? d.bounce?.type ?? 'unknown'}`.slice(0, 500),
            },
            ['sent', 'delivered'],
          );
        }
        for (const email of recipients) {
          if (permanent) {
            await suppressAddress(tx, {
              channel: 'email',
              address: email,
              reason: complaint ? 'complaint' : 'bounce',
              detail: reason ?? undefined,
            });
          }
          await emit(
            tx,
            'email.bounced',
            {
              emailId,
              email,
              kind: complaint ? 'complaint' : 'bounce',
              permanent,
              reason,
              contactId: await contactIdForEmail(tx, email),
            },
            { dedupeKey: `${input.eventId}:${email}` },
          );
        }
        log({
          summary: `${complaint ? 'Spam complaint' : 'Bounce'} for ${recipients.join(', ') || 'an email'}${permanent ? ' (address suppressed)' : ''}`,
        });
        return { handled: true, type: input.type };
      }
      default:
        return { handled: false, type: input.type };
    }
  },
});

// ---------------------------------------------------------------- Quo

const STOP_WORDS = new Set(['stop', 'stopall', 'stop all', 'unsubscribe', 'cancel', 'end', 'quit']);
const START_WORDS = new Set(['start', 'unstop']);

/** "STOP", " stop. " → "stop". Anything that is not exactly a keyword ("please stop") is null. */
export function smsKeyword(text: string): 'stop' | 'start' | null {
  const word = text
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (STOP_WORDS.has(word)) return 'stop';
  if (START_WORDS.has(word)) return 'start';
  return null;
}

const quoMessage = z
  .object({
    id: z.string().min(1),
    from: z.string().optional(),
    to: z.union([z.string(), z.array(z.string())]).optional(),
    text: z.string().nullish(),
    body: z.string().nullish(),
    direction: z.string().optional(),
    status: z.string().optional(),
  })
  .loose();

export const quoWebhook = defineAction({
  name: 'webhooks.quoEvent',
  title: 'Handle a Quo webhook',
  description:
    'System only: apply one verified Quo event. `message.received` records the inbound text as an `sms.received` ' +
    'event; if the whole message is STOP (also STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT) the number is suppressed ' +
    'and the recorded SMS consent cleared, if it is START (or UNSTOP) the suppression is lifted and consent ' +
    'recorded again (source "sms-reply"). `message.delivered` updates the delivery’s status. Other types are ' +
    'acknowledged and ignored. Safe to repeat.',
  audience: 'system',
  mutates: true,
  logOnlyWhenChanged: true,
  returns: '{ handled: boolean, type, keyword? }',
  input: payload,
  async run({ input, tx, log }) {
    const holder = (input.data as { object?: unknown }).object;
    const parsed = quoMessage.safeParse(holder);
    if (!parsed.success) {
      if (input.type.startsWith('message.')) {
        throw new ActionError('invalid_input', 'Unreadable Quo message event.');
      }
      return { handled: false, type: input.type };
    }
    const m = parsed.data;

    if (input.type === 'message.delivered') {
      const status = (m.status ?? 'delivered').toLowerCase();
      await tx
        .update(notificationDeliveries)
        .set(
          status === 'delivered'
            ? { status: 'delivered', deliveredAt: new Date() }
            : { status: 'failed', lastError: `Carrier reported ${status}` },
        )
        .where(
          and(
            eq(notificationDeliveries.providerId, m.id),
            eq(notificationDeliveries.channel, 'sms'),
            eq(notificationDeliveries.status, 'sent'),
          ),
        );
      return { handled: true, type: input.type };
    }

    if (input.type !== 'message.received') return { handled: false, type: input.type };
    if (m.direction && m.direction.toLowerCase() !== 'incoming') {
      return { handled: false, type: input.type };
    }
    const from = m.from ? (toE164(m.from) ?? m.from) : null;
    if (!from) throw new ActionError('invalid_input', 'The inbound text has no sender.');
    const text = (m.text ?? m.body ?? '').toString();
    const to = Array.isArray(m.to) ? (m.to[0] ?? '') : (m.to ?? '');
    const keyword = smsKeyword(text);

    if (keyword === 'stop') {
      await suppressAddress(tx, {
        channel: 'sms',
        address: from,
        reason: 'stop',
        detail: text.slice(0, 100),
      });
    } else if (keyword === 'start') {
      await tx
        .delete(messageSuppressions)
        .where(
          and(
            eq(messageSuppressions.channel, 'sms'),
            eq(messageSuppressions.address, from),
            eq(messageSuppressions.reason, 'stop'),
          ),
        );
      await tx
        .update(contacts)
        .set({
          smsConsentAt: sql`now()`,
          smsConsentSource: 'sms-reply',
          smsConsentText: 'Replied START by text message',
        })
        .where(eq(contacts.phone, from));
    }
    const [contact] = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.phone, from));
    await emit(
      tx,
      'sms.received',
      {
        messageId: m.id,
        from,
        to,
        text: text.slice(0, 1_600),
        keyword,
        contactId: contact?.id ?? null,
      },
      { dedupeKey: m.id },
    );
    log({
      subjectType: contact ? 'contact' : undefined,
      subjectId: contact?.id,
      summary: keyword
        ? `Text from ${from}: ${keyword.toUpperCase()} (${keyword === 'stop' ? 'consent cleared' : 'consent restored'})`
        : `Text received from ${from}`,
    });
    return { handled: true, type: input.type, keyword };
  },
});
