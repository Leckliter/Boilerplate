// ---------------------------------------------------------------- account data
/**
 * "My data": export a copy (a background job writes a private JSON file and tells the person) and
 * "delete my account" (a grace period, then the daily maintenance step anonymises the contact).
 * Module: packages/core/src/account-data (docs/notifications.md → Account data).
 */

import {
  activityLog,
  and,
  apiKeys,
  contactRoles,
  contacts,
  contactTags,
  deletionRequests,
  desc,
  eq,
  files,
  inArray,
  inquiries,
  lte,
  newsletterSubscriptions,
  notificationPreferences,
  notifications,
  or,
  pushSubscriptions,
  settings,
  sql,
  tags,
  type Tx,
} from '@app/db';
import { z } from 'zod';

import { emit } from '../../events/emit';
import { enqueue, getJob } from '../../jobs';
import { notify } from '../../notifications/notify';
import { getStorage } from '../../files/s3';
import { ActionError, defineAction } from '../define';
import { assertOwnerRemains, getContactOrThrow } from '../contacts/shared';

const DEFAULT_GRACE_DAYS = 14;

/** The `account.deletionGraceDays` setting: whole days, 0–365, default 14. */
export async function deletionGraceDays(tx: Tx): Promise<number> {
  const [row] = await tx
    .select()
    .from(settings)
    .where(eq(settings.key, 'account.deletionGraceDays'));
  const n = Number(row?.value);
  return Number.isInteger(n) && n >= 0 && n <= 365 ? n : DEFAULT_GRACE_DAYS;
}

function person(actor: { contactId: string | null; kind: string }): string {
  if (!actor.contactId) throw new ActionError('unauthenticated', 'Sign in to do this.');
  return actor.contactId;
}

/** Deleting your own account is a decision for the person at the keyboard, never a key or an AI. */
function personThemself(actor: { contactId: string | null; kind: string }): string {
  const id = person(actor);
  if (actor.kind !== 'user') {
    throw new ActionError(
      'forbidden',
      'Only the person themself, signed in on the website, can do this.',
    );
  }
  return id;
}

// ---------------------------------------------------------------- export

export const exportData = defineAction({
  name: 'account.exportData',
  title: 'Download my data',
  description:
    'Ask for a copy of everything we hold about the signed-in person: their contact record, tags and roles, ' +
    'notification and consent settings, devices, inbox, inquiries, newsletter status, files list, API keys (never the ' +
    'secrets) and the activity about them — as one JSON file. It is built in the background; when it is ready they ' +
    'get a notification, and `files.list` (purpose `data_export`, subjectId = their contact id) returns it with a ' +
    'download link. A new export replaces the previous one; files are removed after 7 days. Needs file storage.',
  audience: 'authenticated',
  mutates: true,
  rateLimit: { limit: 3, perSeconds: 24 * 60 * 60 },
  returns: '{ queued: true }',
  input: z.object({}),
  async run({ actor, tx, log }) {
    const contactId = person(actor);
    if (!getStorage() || !getJob('account.exportData')) {
      throw new ActionError(
        'conflict',
        'Data exports aren’t set up here yet (file storage is missing).',
      );
    }
    await enqueue(tx, 'account.exportData', { contactId }, { dedupeKey: `export:${contactId}` });
    log({
      subjectType: 'contact',
      subjectId: contactId,
      summary: 'Asked for a copy of their data',
    });
    return { queued: true as const };
  },
});

export const exportPayload = defineAction({
  name: 'account.exportPayload',
  title: 'Gather a person’s data',
  description:
    'System only (used by the data-export job): everything held about one contact as a JSON-able object.',
  audience: 'system',
  mutates: false,
  returns: 'The export document (object)',
  input: z.object({ contactId: z.uuid() }),
  async run({ input, tx }) {
    const c = await getContactOrThrow(tx, input.contactId);
    const [tagRows, roles, prefs, push, inbox, activity, asked, news, fileRows, keys, deletions] =
      await Promise.all([
        tx
          .select({ slug: tags.slug, label: tags.label })
          .from(contactTags)
          .innerJoin(tags, eq(tags.id, contactTags.tagId))
          .where(eq(contactTags.contactId, c.id)),
        tx
          .select({ role: contactRoles.role })
          .from(contactRoles)
          .where(eq(contactRoles.contactId, c.id)),
        tx
          .select()
          .from(notificationPreferences)
          .where(eq(notificationPreferences.contactId, c.id)),
        tx.select().from(pushSubscriptions).where(eq(pushSubscriptions.contactId, c.id)),
        tx
          .select()
          .from(notifications)
          .where(eq(notifications.contactId, c.id))
          .orderBy(desc(notifications.createdAt))
          .limit(500),
        tx
          .select({
            occurredAt: activityLog.occurredAt,
            action: activityLog.action,
            summary: activityLog.summary,
            channel: activityLog.channel,
            ok: activityLog.ok,
            ip: activityLog.ip,
          })
          .from(activityLog)
          .where(or(eq(activityLog.subjectId, c.id), eq(activityLog.actorContactId, c.id)))
          .orderBy(desc(activityLog.occurredAt))
          .limit(5_000),
        tx.select().from(inquiries).where(eq(inquiries.contactId, c.id)),
        tx
          .select()
          .from(newsletterSubscriptions)
          .where(
            c.email
              ? or(
                  eq(newsletterSubscriptions.contactId, c.id),
                  eq(newsletterSubscriptions.email, c.email),
                )
              : eq(newsletterSubscriptions.contactId, c.id),
          ),
        tx
          .select()
          .from(files)
          .where(
            and(
              eq(files.subjectType, 'contact'),
              eq(files.subjectId, c.id),
              eq(files.status, 'ready'),
            ),
          ),
        tx.select().from(apiKeys).where(eq(apiKeys.contactId, c.id)),
        tx.select().from(deletionRequests).where(eq(deletionRequests.contactId, c.id)),
      ]);
    return {
      exportedAt: new Date().toISOString(),
      note: 'Everything we hold about you. Secrets (API key values, push keys) are never included.',
      contact: {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        companyName: c.companyName,
        displayName: c.displayName,
        email: c.email,
        phone: c.phone,
        status: c.status,
        source: c.source,
        notes: c.notes,
        createdAt: c.createdAt,
        smsConsent: c.smsConsentAt
          ? { at: c.smsConsentAt, source: c.smsConsentSource, text: c.smsConsentText }
          : null,
      },
      tags: tagRows,
      roles: roles.map((r) => r.role),
      notificationPreferences: prefs.map((p) => ({
        type: p.type,
        channel: p.channel,
        enabled: p.enabled,
      })),
      pushDevices: push.map((p) => ({
        label: p.label,
        service: new URL(p.endpoint).host,
        createdAt: p.createdAt,
      })),
      notifications: inbox.map((n) => ({
        type: n.type,
        title: n.content.title,
        body: n.content.body,
        createdAt: n.createdAt,
        readAt: n.readAt,
      })),
      inquiries: asked.map((i) => ({
        subject: i.subject,
        message: i.message,
        status: i.status,
        createdAt: i.createdAt,
      })),
      newsletter: news.map((n) => ({
        email: n.email,
        status: n.status,
        consentAt: n.consentAt,
        consentText: n.consentText,
        consentSource: n.consentSource,
        unsubscribedAt: n.unsubscribedAt,
      })),
      files: fileRows.map((f) => ({
        purpose: f.purpose,
        filename: f.filename,
        sizeBytes: f.sizeBytes,
        createdAt: f.createdAt,
      })),
      apiKeys: keys.map((k) => ({
        name: k.name,
        prefix: k.prefix,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt,
        revokedAt: k.revokedAt,
      })),
      deletionRequests: deletions.map((d) => ({
        status: d.status,
        requestedAt: d.requestedAt,
        scheduledFor: d.scheduledFor,
      })),
      activity,
    };
  },
});

export const recordExport = defineAction({
  name: 'account.recordExport',
  title: 'Record a finished data export',
  description:
    'System only (used by the data-export job): register the stored export file for the contact, replace their ' +
    'previous export, and tell them it is ready.',
  audience: 'system',
  mutates: true,
  returns: '{ fileId }',
  input: z.object({
    contactId: z.uuid(),
    fileId: z.uuid(),
    bucket: z.string(),
    path: z.string(),
    filename: z.string(),
    sizeBytes: z.number().int().min(0),
  }),
  async run({ input, tx, log }) {
    await getContactOrThrow(tx, input.contactId);
    const older = await tx
      .update(files)
      .set({ status: 'deleted' })
      .where(
        and(
          eq(files.purpose, 'data_export'),
          eq(files.subjectId, input.contactId),
          eq(files.status, 'ready'),
        ),
      )
      .returning({ bucket: files.bucket, path: files.path });
    if (getJob('files.deleteObject'))
      for (const f of older) await enqueue(tx, 'files.deleteObject', f);
    await tx.insert(files).values({
      id: input.fileId,
      purpose: 'data_export',
      subjectType: 'contact',
      subjectId: input.contactId,
      bucket: input.bucket,
      path: input.path,
      filename: input.filename,
      contentType: 'application/json',
      sizeBytes: input.sizeBytes,
      status: 'ready',
      uploadedByContactId: null,
    });
    await notify(tx, 'account.exportReady', {
      to: input.contactId,
      data: { filename: input.filename },
      dedupeKey: input.fileId,
    });
    log({
      subjectType: 'contact',
      subjectId: input.contactId,
      summary: 'Their data export is ready',
    });
    return { fileId: input.fileId };
  },
});

// ---------------------------------------------------------------- deletion

export const requestDeletion = defineAction({
  name: 'account.requestDeletion',
  title: 'Delete my account',
  description:
    'Ask to delete the signed-in person’s account. Nothing is erased yet: after a grace period (setting ' +
    '`account.deletionGraceDays`, default 14 days) the daily job wipes their personal data (name, email, phone, ' +
    'tags, roles, inbox, devices, files, API keys) and unlinks their login; the contact row stays, anonymised, so ' +
    'history still points somewhere. They can cancel any time before (account.cancelDeletion). Refused for the ' +
    'last owner. Only the person themself, signed in on the website — not an API key or AI. Asking again while a ' +
    'request is pending returns that request.',
  audience: 'authenticated',
  mutates: true,
  destructive: true,
  rateLimit: { limit: 5, perSeconds: 60 * 60 },
  returns: '{ id, requestedAt, scheduledFor, graceDays, alreadyRequested }',
  input: z.object({ reason: z.string().trim().max(1_000).optional() }),
  async run({ input, actor, tx, log }) {
    const contactId = personThemself(actor);
    const contact = await getContactOrThrow(tx, contactId);
    const [open] = await tx
      .select()
      .from(deletionRequests)
      .where(
        and(eq(deletionRequests.contactId, contactId), eq(deletionRequests.status, 'pending')),
      );
    const graceDays = await deletionGraceDays(tx);
    if (open) {
      return {
        id: open.id,
        requestedAt: open.requestedAt,
        scheduledFor: open.scheduledFor,
        graceDays,
        alreadyRequested: true,
      };
    }
    await assertOwnerRemains(tx, [contactId]);
    const requestedAt = new Date();
    const scheduledFor = new Date(requestedAt.getTime() + graceDays * 86_400_000);
    const [row] = await tx
      .insert(deletionRequests)
      .values({ contactId, reason: input.reason || null, requestedAt, scheduledFor })
      .returning();
    await notify(tx, 'account.deletionScheduled', {
      to: contactId,
      data: {
        date: scheduledFor.toISOString().slice(0, 10),
        days: graceDays,
      },
      dedupeKey: row!.id,
    });
    await emit(tx, 'account.deletion_requested', {
      contactId,
      displayName: contact.displayName,
      scheduledFor: scheduledFor.toISOString(),
    });
    log({
      subjectType: 'contact',
      subjectId: contactId,
      summary: `Asked to delete their account (erased ${scheduledFor.toISOString().slice(0, 10)})`,
    });
    return { id: row!.id, requestedAt, scheduledFor, graceDays, alreadyRequested: false };
  },
});

export const cancelDeletion = defineAction({
  name: 'account.cancelDeletion',
  title: 'Keep my account',
  description:
    'Cancel a pending account deletion before the grace period ends. Nothing was erased yet.',
  audience: 'authenticated',
  mutates: true,
  returns: '{ id }',
  input: z.object({}),
  async run({ actor, tx, log }) {
    const contactId = personThemself(actor);
    const [row] = await tx
      .update(deletionRequests)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(and(eq(deletionRequests.contactId, contactId), eq(deletionRequests.status, 'pending')))
      .returning({ id: deletionRequests.id });
    if (!row) throw new ActionError('not_found', 'There is no pending deletion to cancel.');
    log({
      subjectType: 'contact',
      subjectId: contactId,
      summary: 'Cancelled their account deletion',
    });
    return { id: row.id };
  },
});

export const deletionStatus = defineAction({
  name: 'account.deletionStatus',
  title: 'Is my account being deleted?',
  description:
    'The signed-in person’s pending deletion request (when it was asked and when it will happen), or null, and ' +
    'the grace period in days.',
  audience: 'authenticated',
  mutates: false,
  returns: '{ pending: { id, requestedAt, scheduledFor } | null, graceDays }',
  input: z.object({}),
  async run({ actor, tx }) {
    const contactId = person(actor);
    const [open] = await tx
      .select()
      .from(deletionRequests)
      .where(
        and(eq(deletionRequests.contactId, contactId), eq(deletionRequests.status, 'pending')),
      );
    return {
      pending: open
        ? { id: open.id, requestedAt: open.requestedAt, scheduledFor: open.scheduledFor }
        : null,
      graceDays: await deletionGraceDays(tx),
    };
  },
});

/** Personal-data columns scrubbed from the change history of an anonymised contact. */
const PII_KEYS = [
  'first_name',
  'last_name',
  'company_name',
  'display_name',
  'email',
  'phone',
  'notes',
  'auth_user_id',
  'sms_consent_text',
  'label',
  'name',
  'message',
  'subject',
  'staff_note',
];

/**
 * Wipe a contact's personal data and unlink the login. The row stays (history points at it) but
 * holds nothing about the person. Also scrubs the personal fields from the field-level change history
 * and the input of activity rows about them — the one place an audit row is edited (erasure).
 */
async function anonymise(tx: Tx, contactId: string) {
  const [c] = await tx.select().from(contacts).where(eq(contacts.id, contactId)).for('update');
  if (!c) return null;
  await tx
    .update(contacts)
    .set({
      firstName: null,
      lastName: null,
      companyName: null,
      displayName: 'Deleted account',
      email: null,
      phone: null,
      notes: null,
      authUserId: null,
      smsConsentAt: null,
      smsConsentSource: null,
      smsConsentText: null,
      status: 'archived',
    })
    .where(eq(contacts.id, contactId));
  await tx.delete(contactRoles).where(eq(contactRoles.contactId, contactId));
  await tx.delete(contactTags).where(eq(contactTags.contactId, contactId));
  await tx.delete(notificationPreferences).where(eq(notificationPreferences.contactId, contactId));
  await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.contactId, contactId));
  await tx.delete(notifications).where(eq(notifications.contactId, contactId));
  await tx
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.contactId, contactId), sql`${apiKeys.revokedAt} is null`));
  await tx
    .update(inquiries)
    .set({
      name: 'Deleted',
      email: 'deleted@example.invalid',
      phone: null,
      subject: null,
      message: '[removed]',
      staffNote: null,
    })
    .where(eq(inquiries.contactId, contactId));
  await tx
    .delete(newsletterSubscriptions)
    .where(
      c.email
        ? or(
            eq(newsletterSubscriptions.contactId, contactId),
            eq(newsletterSubscriptions.email, c.email),
          )
        : eq(newsletterSubscriptions.contactId, contactId),
    );
  const gone = await tx
    .update(files)
    .set({ status: 'deleted' })
    .where(
      and(
        eq(files.subjectType, 'contact'),
        eq(files.subjectId, contactId),
        inArray(files.status, ['ready', 'pending']),
      ),
    )
    .returning({ bucket: files.bucket, path: files.path });
  if (getJob('files.deleteObject'))
    for (const f of gone) await enqueue(tx, 'files.deleteObject', f);
  const keys = sql.raw(`ARRAY[${PII_KEYS.map((k) => `'${k}'`).join(',')}]::text[]`);
  await tx.execute(
    sql`update app.change_log set before = before - ${keys}, after = after - ${keys} where subject_id = ${contactId}`,
  );
  await tx.update(activityLog).set({ input: null }).where(eq(activityLog.subjectId, contactId));
  return c;
}

export const processDeletions = defineAction({
  name: 'account.processDeletions',
  title: 'Carry out due account deletions',
  description:
    'System only (the daily maintenance step): anonymise every contact whose pending deletion is past its ' +
    'scheduled time, emit `account.deleted` for each, and keep (with a note) any request that would remove the ' +
    'last active owner. Safe to run repeatedly.',
  audience: 'system',
  mutates: true,
  logOnlyWhenChanged: true,
  returns: '{ processed: number, skipped: number }',
  input: z.object({ limit: z.number().int().min(1).max(100).default(25) }),
  async run({ input, tx, log }) {
    const due = await tx
      .select()
      .from(deletionRequests)
      .where(
        and(eq(deletionRequests.status, 'pending'), lte(deletionRequests.scheduledFor, new Date())),
      )
      .orderBy(deletionRequests.scheduledFor)
      .limit(input.limit)
      .for('update', { skipLocked: true });
    let processed = 0;
    let skipped = 0;
    for (const r of due) {
      try {
        await assertOwnerRemains(tx, [r.contactId]);
      } catch (err) {
        if (!(err instanceof ActionError)) throw err;
        skipped++;
        await tx
          .update(deletionRequests)
          .set({
            note: 'Not carried out: this is the last owner. Make someone else an owner, then cancel and ask again.',
          })
          .where(eq(deletionRequests.id, r.id));
        continue;
      }
      const c = await anonymise(tx, r.contactId);
      await tx
        .update(deletionRequests)
        .set({ status: 'completed', completedAt: new Date(), note: null })
        .where(eq(deletionRequests.id, r.id));
      await emit(tx, 'account.deleted', {
        contactId: r.contactId,
        authUserId: c?.authUserId ?? null,
      });
      processed++;
    }
    if (processed || skipped) {
      log({
        summary: `Anonymised ${processed} account${processed === 1 ? '' : 's'}${skipped ? `, ${skipped} held back (last owner)` : ''}`,
      });
    }
    return { processed, skipped };
  },
});
