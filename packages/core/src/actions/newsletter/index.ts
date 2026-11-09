// ---------------------------------------------------------------- newsletter
/** Newsletter sign-up with double opt-in (docs/notifications.md → Newsletter). */

import { and, contacts, contactTags, eq, newsletterSubscriptions, type Tx } from '@app/db';
import { z } from 'zod';

import { getSiteUrl } from '../../env';
import { emit } from '../../events/emit';
import { appName } from '../../messaging/email-layout';
import { notify } from '../../notifications/notify';
import { signLink, verifyLink } from '../../notifications/tokens';
import { ActionError, defineAction } from '../define';
import { findOrCreateLead } from '../contacts/lead';
import { emailField, resolveTagIds } from '../contacts/shared';

const CONFIRM_KIND = 'newsletter.confirm';
const UNSUBSCRIBE_KIND = 'newsletter.unsubscribe';
const CONFIRM_TTL_MS = 7 * 24 * 60 * 60_000;
/** Unsubscribe links in newsletters must keep working "forever". */
const UNSUBSCRIBE_TTL_MS = 10 * 365 * 24 * 60 * 60_000;

/** The wording a subscriber agrees to; stored with their consent. */
export const newsletterConsentText = () =>
  `Send me the ${appName()} newsletter by email. I can unsubscribe at any time.`;

/** The link for a newsletter's footer (and List-Unsubscribe header): works without signing in. */
export function newsletterUnsubscribeUrl(subscriptionId: string): string {
  return `${getSiteUrl()}/api/v1/newsletter/unsubscribe?t=${signLink(UNSUBSCRIBE_KIND, subscriptionId, UNSUBSCRIBE_TTL_MS)}`;
}

const generic = {
  received: true as const,
  message: 'If this address isn’t on the list yet, we’ve emailed it a link to confirm.',
};

async function setNewsletterTag(tx: Tx, contactId: string, on: boolean) {
  const [tagId] = await resolveTagIds(tx, ['newsletter']);
  if (on) await tx.insert(contactTags).values({ contactId, tagId: tagId! }).onConflictDoNothing();
  else {
    await tx
      .delete(contactTags)
      .where(and(eq(contactTags.contactId, contactId), eq(contactTags.tagId, tagId!)));
  }
}

export const subscribeNewsletter = defineAction({
  name: 'newsletter.subscribe',
  title: 'Subscribe to the newsletter',
  description:
    'Public: ask to join the newsletter. Double opt-in: this only records a PENDING subscription (with the wording ' +
    'shown) and emails a confirmation link; nobody is subscribed until they click it (newsletter.confirm). Finds ' +
    'or creates the contact (a new one is tagged `lead`). The answer is the same whether or not the address was ' +
    'already known, so it cannot be used to find out who is on the list. `website` is a honeypot: leave it empty.',
  audience: 'public',
  mutates: true,
  logOnlyWhenChanged: true,
  rateLimit: { limit: 5, perSeconds: 60 * 60 },
  humanCheck: true,
  returns: '{ received: true, message }',
  input: z.object({
    email: emailField,
    firstName: z.string().trim().min(1).max(100).optional(),
    source: z.string().trim().min(1).max(50).default('website'),
    website: z.string().max(500).optional().describe('Honeypot — leave empty.'),
  }),
  async run({ input, tx, log }) {
    if (input.website?.trim()) return generic;
    const [existing] = await tx
      .select()
      .from(newsletterSubscriptions)
      .where(eq(newsletterSubscriptions.email, input.email))
      .for('update');
    if (existing?.status === 'subscribed') return generic;
    const { contact } = await findOrCreateLead(tx, {
      email: input.email,
      name: input.firstName,
      source: input.source,
    });
    if (contact.status !== 'active') return generic;
    const [sub] = existing
      ? await tx
          .update(newsletterSubscriptions)
          .set({
            status: 'pending',
            contactId: contact.id,
            consentText: newsletterConsentText(),
            consentSource: input.source,
          })
          .where(eq(newsletterSubscriptions.id, existing.id))
          .returning()
      : await tx
          .insert(newsletterSubscriptions)
          .values({
            email: input.email,
            contactId: contact.id,
            consentText: newsletterConsentText(),
            consentSource: input.source,
          })
          .returning();
    const token = signLink(CONFIRM_KIND, sub!.id, CONFIRM_TTL_MS);
    await notify(tx, 'newsletter.confirm', {
      to: contact.id,
      data: { confirmUrl: `${getSiteUrl()}/api/v1/newsletter/confirm?t=${token}` },
      subject: { type: 'newsletter_subscription', id: sub!.id },
      // At most one confirmation email per address per day.
      dedupeKey: `${sub!.id}:${new Date().toISOString().slice(0, 10)}`,
    });
    log({
      subjectType: 'contact',
      subjectId: contact.id,
      summary: `Asked to join the newsletter (confirmation email sent)`,
    });
    return generic;
  },
});

export const confirmNewsletter = defineAction({
  name: 'newsletter.confirm',
  title: 'Confirm a newsletter subscription',
  description:
    'Public: the second step of the double opt-in. Takes the signed `token` from the confirmation email (valid 7 ' +
    'days), marks the subscription subscribed, records the consent (when, what wording, through which door), ' +
    'tags the contact `newsletter` and emits `newsletter.subscribed`. Confirming twice is fine.',
  audience: 'public',
  mutates: true,
  rateLimit: { limit: 30, perSeconds: 60 * 60 },
  logInput: () => ({ token: '[redacted]' }),
  returns: '{ status: "subscribed", email }',
  input: z.object({ token: z.string().min(10).max(500) }),
  async run({ input, tx, log }) {
    const id = verifyLink(CONFIRM_KIND, input.token);
    if (!id)
      throw new ActionError('invalid_input', 'That confirmation link isn’t valid or has expired.');
    const [sub] = await tx
      .select()
      .from(newsletterSubscriptions)
      .where(eq(newsletterSubscriptions.id, id))
      .for('update');
    if (!sub) throw new ActionError('not_found', 'That confirmation link isn’t valid.');
    if (sub.status === 'subscribed') return { status: 'subscribed' as const, email: sub.email };
    const now = new Date();
    await tx
      .update(newsletterSubscriptions)
      .set({ status: 'subscribed', confirmedAt: now, consentAt: now, unsubscribedAt: null })
      .where(eq(newsletterSubscriptions.id, sub.id));
    if (sub.contactId) {
      await setNewsletterTag(tx, sub.contactId, true);
      await emit(
        tx,
        'newsletter.subscribed',
        { contactId: sub.contactId, email: sub.email, source: sub.consentSource ?? 'website' },
        { dedupeKey: `${sub.id}:${now.getTime()}` },
      );
    }
    log({
      subjectType: 'contact',
      subjectId: sub.contactId ?? undefined,
      summary: `Confirmed the newsletter subscription (${sub.email})`,
    });
    return { status: 'subscribed' as const, email: sub.email };
  },
});

export const unsubscribeNewsletter = defineAction({
  name: 'newsletter.unsubscribe',
  title: 'Unsubscribe from the newsletter',
  description:
    'Public: leave the newsletter. Pass the signed `token` from the link in a newsletter, or — when signed in — ' +
    'nothing, to unsubscribe your own address. Removes the `newsletter` tag and records when. Unsubscribing twice ' +
    'is fine. (Transactional emails like receipts are not affected.)',
  audience: 'public',
  mutates: true,
  rateLimit: { limit: 30, perSeconds: 60 * 60 },
  logInput: () => ({ token: '[redacted]' }),
  returns: '{ status: "unsubscribed" }',
  input: z.object({ token: z.string().min(10).max(500).optional() }),
  async run({ input, actor, tx, log }) {
    let sub: typeof newsletterSubscriptions.$inferSelect | undefined;
    if (input.token) {
      const id = verifyLink(UNSUBSCRIBE_KIND, input.token);
      if (!id) throw new ActionError('invalid_input', 'That unsubscribe link isn’t valid.');
      [sub] = await tx
        .select()
        .from(newsletterSubscriptions)
        .where(eq(newsletterSubscriptions.id, id))
        .for('update');
    } else {
      if (!actor.contactId) {
        throw new ActionError(
          'unauthenticated',
          'Use the unsubscribe link in the email, or sign in.',
        );
      }
      const [me] = await tx.select().from(contacts).where(eq(contacts.id, actor.contactId));
      if (me?.email) {
        [sub] = await tx
          .select()
          .from(newsletterSubscriptions)
          .where(eq(newsletterSubscriptions.email, me.email))
          .for('update');
      }
    }
    if (!sub) throw new ActionError('not_found', 'You’re not on the newsletter list.');
    if (sub.status !== 'unsubscribed') {
      await tx
        .update(newsletterSubscriptions)
        .set({ status: 'unsubscribed', unsubscribedAt: new Date() })
        .where(eq(newsletterSubscriptions.id, sub.id));
    }
    if (sub.contactId) await setNewsletterTag(tx, sub.contactId, false);
    log({
      subjectType: 'contact',
      subjectId: sub.contactId ?? undefined,
      summary: `Unsubscribed from the newsletter (${sub.email})`,
    });
    return { status: 'unsubscribed' as const };
  },
});
