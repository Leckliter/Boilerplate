import {
  activityLog,
  apiKeys,
  changeLog,
  contacts,
  contactRoles,
  contactTags,
  deletionRequests,
  eq,
  files,
  getDb,
  inquiries,
  newsletterSubscriptions,
  notificationDeliveries,
  notifications,
  pushSubscriptions,
  settings,
} from '@app/db';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { guestActor, systemActor, userActor } from '../src/access';
import { callAction, createContact, setSetting } from '../src/actions';
import {
  cancelDeletion,
  deletionStatus,
  exportData,
  exportPayload,
  processDeletions,
  recordExport,
  requestDeletion,
} from '../src/actions/account/data';
import { createInquiry } from '../src/actions/inquiries';
import { listFiles, requestUpload } from '../src/actions/files';
import { subscribePush } from '../src/actions/push';
import { setStorageForTests, type Storage } from '../src/files/s3';
import { runDueJobs } from '../src/jobs';
import { runMaintenance } from '../src/maintenance';
import { assertLocalDatabase, ifEventsEnabled, makeActor, resetDatabase } from './setup';

beforeAll(assertLocalDatabase);
beforeEach(resetDatabase);
afterEach(() => setStorageForTests(undefined));

const ok = async <T>(p: Promise<{ ok: boolean }>) => {
  const r = (await p) as { ok: boolean; data?: T; error?: unknown };
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.data as T;
};

function fakeStorage() {
  const objects = new Map<string, Uint8Array>();
  const removed: string[] = [];
  const key = (b: string, p: string) => `${b}/${p}`;
  const storage: Storage = {
    createUploadUrl: async (b, p) => `https://s3.test/${key(b, p)}?sig=1`,
    put: async (b, p, bytes) => void objects.set(key(b, p), bytes),
    stat: async (b, p) =>
      objects.has(key(b, p))
        ? { sizeBytes: objects.get(key(b, p))!.length, contentType: 'application/json' }
        : null,
    signedUrl: async (b, p) => `https://s3.test/${key(b, p)}?signed=1`,
    publicUrl: async (b, p) => `https://cdn.test/${key(b, p)}`,
    remove: async (b, p) => void removed.push(key(b, p)),
  };
  setStorageForTests(storage);
  return { objects, removed };
}

/** A person with data in most tables, acting as themself on the website. */
async function person(extraRoles: Parameters<typeof makeActor>[0] = []) {
  const admin = await makeActor(['owner'], 'Admin');
  const c = await ok<{ id: string }>(
    callAction(
      createContact,
      {
        firstName: 'Pat',
        lastName: 'Private',
        email: 'pat@example.com',
        phone: '816-555-0100',
        notes: 'Likes cats',
        tags: ['customer'],
      },
      admin,
    ),
  );
  await getDb().update(contacts).set({ authUserId: 'auth-pat' }).where(eq(contacts.id, c.id));
  if (extraRoles.length)
    await getDb()
      .insert(contactRoles)
      .values(extraRoles.map((role) => ({ contactId: c.id, role })));
  return { admin, id: c.id, actor: userActor({ contactId: c.id, roles: extraRoles }) };
}

describe('account.exportData', () => {
  it('builds a JSON file in the background, stores it privately, replaces the old one and notifies', async () => {
    const s = fakeStorage();
    const { id, actor } = await person();
    await ok(
      callAction(
        subscribePush,
        {
          endpoint: 'https://push.test/abc',
          keys: { p256dh: 'x'.repeat(20), auth: 'y'.repeat(12) },
        },
        actor,
      ),
    );
    await ok(
      callAction(
        createInquiry,
        { name: 'Pat Private', email: 'pat@example.com', message: 'Hello there, friends' },
        guestActor(),
      ),
    );

    expect(await ok(callAction(exportData, {}, actor))).toEqual({ queued: true });
    await runDueJobs();
    const [file] = await getDb().select().from(files).where(eq(files.purpose, 'data_export'));
    expect(file).toMatchObject({
      subjectId: id,
      bucket: 'private-files',
      status: 'ready',
      contentType: 'application/json',
    });
    const json = JSON.parse(new TextDecoder().decode(s.objects.get(`private-files/${file!.path}`)));
    expect(json.contact).toMatchObject({
      email: 'pat@example.com',
      phone: '+18165550100',
      notes: 'Likes cats',
    });
    expect(json.tags.map((t: { slug: string }) => t.slug)).toEqual(['customer']);
    expect(json.inquiries).toHaveLength(1);
    expect(json.pushDevices[0]).toMatchObject({ service: 'push.test' });
    expect(JSON.stringify(json)).not.toContain('yyyyyyyy');
    expect(json.activity.length).toBeGreaterThan(0);
    const told = (await getDb().select().from(notifications)).find(
      (n) => n.type === 'account.exportReady',
    );
    expect(told).toMatchObject({ contactId: id });
    expect(await getDb().select().from(notificationDeliveries)).not.toHaveLength(0);

    // The person (and only they) can fetch it through files.list.
    const list = await ok<{ url: string; filename: string }[]>(
      callAction(listFiles, { purpose: 'data_export', subjectId: id }, actor),
    );
    expect(list).toHaveLength(1);
    expect(list[0]!.url).toContain('signed=1');
    const manager = await makeActor(['manager']);
    expect(
      await callAction(listFiles, { purpose: 'data_export', subjectId: id }, manager),
    ).toMatchObject({ ok: false, error: { code: 'forbidden' } });

    // Asking again replaces the previous file (its bytes are removed by a job).
    await ok(callAction(exportData, {}, actor));
    await runDueJobs();
    await runDueJobs();
    expect(await getDb().select().from(files).where(eq(files.status, 'ready'))).toHaveLength(1);
    expect(s.removed).toEqual([`private-files/${file!.path}`]);
  });

  it('nobody can upload a data_export file; without storage it says so; signed-out visitors are refused', async () => {
    fakeStorage();
    const { id, actor } = await person();
    expect(
      await callAction(
        requestUpload,
        {
          purpose: 'data_export',
          subjectId: id,
          filename: 'x.json',
          contentType: 'application/json',
          sizeBytes: 10,
        },
        actor,
      ),
    ).toMatchObject({ ok: false, error: { code: 'forbidden' } });
    setStorageForTests(null);
    expect(await callAction(exportData, {}, actor)).toMatchObject({
      ok: false,
      error: { code: 'conflict' },
    });
    expect(await callAction(exportData, {}, guestActor())).toMatchObject({
      ok: false,
      error: { code: 'unauthenticated' },
    });
  });

  it('the system actions behind it refuse everyone else', async () => {
    const { id, actor } = await person();
    const owner = await makeActor(['owner']);
    for (const who of [actor, owner]) {
      expect(await callAction(exportPayload, { contactId: id }, who)).toMatchObject({
        ok: false,
        error: { code: 'forbidden' },
      });
      expect(
        await callAction(
          recordExport,
          {
            contactId: id,
            fileId: crypto.randomUUID(),
            bucket: 'b',
            path: 'p',
            filename: 'f',
            sizeBytes: 1,
          },
          who,
        ),
      ).toMatchObject({ ok: false, error: { code: 'forbidden' } });
    }
    expect((await callAction(exportPayload, { contactId: id }, systemActor())).ok).toBe(true);
  });
});

describe('account deletion', () => {
  it('request → grace period → cancel; status reflects it', async () => {
    const { id, actor } = await person();
    expect(await ok(callAction(deletionStatus, {}, actor))).toMatchObject({
      pending: null,
      graceDays: 14,
    });
    const req = await ok<{ scheduledFor: Date; graceDays: number; alreadyRequested: boolean }>(
      callAction(requestDeletion, { reason: 'Moving' }, actor),
    );
    expect(req).toMatchObject({ graceDays: 14, alreadyRequested: false });
    expect(Math.round((req.scheduledFor.getTime() - Date.now()) / 86_400_000)).toBe(14);
    expect(await ok(callAction(requestDeletion, {}, actor))).toMatchObject({
      alreadyRequested: true,
    });
    expect(await getDb().select().from(deletionRequests)).toHaveLength(1);
    expect(
      (await getDb().select().from(notifications)).some(
        (n) => n.type === 'account.deletionScheduled' && n.contactId === id,
      ),
    ).toBe(true);
    await ifEventsEnabled('account.deletion_requested', (e) => expect(e).toHaveLength(1));

    await ok(callAction(cancelDeletion, {}, actor));
    expect(await ok(callAction(deletionStatus, {}, actor))).toMatchObject({ pending: null });
    expect(await callAction(cancelDeletion, {}, actor)).toMatchObject({
      ok: false,
      error: { code: 'not_found' },
    });
    // Nothing was touched.
    expect((await getDb().select().from(contacts).where(eq(contacts.id, id)))[0]).toMatchObject({
      email: 'pat@example.com',
      status: 'active',
    });
    // A new request after cancelling is fine.
    expect(await ok(callAction(requestDeletion, {}, actor))).toMatchObject({
      alreadyRequested: false,
    });
  });

  it('the grace period is the account.deletionGraceDays setting', async () => {
    const { actor, admin } = await person();
    await ok(callAction(setSetting, { key: 'account.deletionGraceDays', value: 3 }, admin));
    const req = await ok<{ graceDays: number; scheduledFor: Date }>(
      callAction(requestDeletion, {}, actor),
    );
    expect(req.graceDays).toBe(3);
    expect(Math.round((req.scheduledFor.getTime() - Date.now()) / 86_400_000)).toBe(3);
    await getDb()
      .update(settings)
      .set({ value: 'banana' })
      .where(eq(settings.key, 'account.deletionGraceDays'));
    expect((await ok<{ graceDays: number }>(callAction(deletionStatus, {}, actor))).graceDays).toBe(
      14,
    );
  });

  it('only the person themself may ask: not a visitor, not an API key acting as them', async () => {
    const { actor } = await person();
    expect(await callAction(requestDeletion, {}, guestActor())).toMatchObject({
      ok: false,
      error: { code: 'unauthenticated' },
    });
    expect(
      await callAction(requestDeletion, {}, { ...actor, kind: 'api_key', channel: 'api' }),
    ).toMatchObject({ ok: false, error: { code: 'forbidden' } });
    expect(await callAction(cancelDeletion, {}, guestActor())).toMatchObject({
      ok: false,
      error: { code: 'unauthenticated' },
    });
    expect(await callAction(deletionStatus, {}, guestActor())).toMatchObject({
      ok: false,
      error: { code: 'unauthenticated' },
    });
  });

  it('the last owner cannot ask; with another owner they can', async () => {
    const owner = await makeActor(['owner']);
    expect(await callAction(requestDeletion, {}, owner)).toMatchObject({
      ok: false,
      error: { code: 'conflict' },
    });
    await makeActor(['owner']);
    expect((await callAction(requestDeletion, {}, owner)).ok).toBe(true);
  });

  it('after the grace period the daily maintenance step anonymises the account', async () => {
    const s = fakeStorage();
    const { id, actor } = await person();
    await ok(
      callAction(
        createInquiry,
        { name: 'Pat Private', email: 'pat@example.com', message: 'Secret question here' },
        guestActor(),
      ),
    );
    await ok(
      callAction(
        subscribePush,
        {
          endpoint: 'https://push.test/abc',
          keys: { p256dh: 'x'.repeat(20), auth: 'y'.repeat(12) },
        },
        actor,
      ),
    );
    await getDb()
      .insert(apiKeys)
      .values({ contactId: id, name: 'mine', prefix: 'app_sk_ab12', keyHash: 'hash-of-pat-key' });
    await getDb()
      .insert(newsletterSubscriptions)
      .values({ email: 'pat@example.com', contactId: id, status: 'subscribed' });
    await getDb()
      .insert(files)
      .values({
        purpose: 'contact_document',
        subjectType: 'contact',
        subjectId: id,
        bucket: 'private-files',
        path: `contact/${id}/doc.pdf`,
        filename: 'doc.pdf',
        contentType: 'application/pdf',
        status: 'ready',
      });
    await ok(callAction(requestDeletion, {}, actor));

    // Not yet due: nothing happens.
    expect((await runMaintenance()).steps['account.deletions']).toMatchObject({ processed: 0 });
    expect((await getDb().select().from(contacts).where(eq(contacts.id, id)))[0]!.email).toBe(
      'pat@example.com',
    );

    await getDb()
      .update(deletionRequests)
      .set({ scheduledFor: new Date(Date.now() - 1000) });
    expect((await runMaintenance()).steps['account.deletions']).toMatchObject({
      processed: 1,
      skipped: 0,
    });

    const [gone] = await getDb().select().from(contacts).where(eq(contacts.id, id));
    expect(gone).toMatchObject({
      displayName: 'Deleted account',
      email: null,
      phone: null,
      firstName: null,
      lastName: null,
      notes: null,
      authUserId: null,
      status: 'archived',
      smsConsentAt: null,
    });
    expect(
      await getDb().select().from(contactTags).where(eq(contactTags.contactId, id)),
    ).toHaveLength(0);
    expect(
      await getDb().select().from(pushSubscriptions).where(eq(pushSubscriptions.contactId, id)),
    ).toHaveLength(0);
    expect(
      await getDb().select().from(notifications).where(eq(notifications.contactId, id)),
    ).toHaveLength(0);
    expect(await getDb().select().from(newsletterSubscriptions)).toHaveLength(0);
    expect((await getDb().select().from(inquiries))[0]).toMatchObject({
      name: 'Deleted',
      message: '[removed]',
      phone: null,
    });
    expect((await getDb().select().from(deletionRequests))[0]).toMatchObject({
      status: 'completed',
    });
    expect(
      (await getDb().select().from(apiKeys).where(eq(apiKeys.contactId, id))).every(
        (k) => k.revokedAt,
      ),
    ).toBe(true);
    const gonefiles = await getDb().select().from(files).where(eq(files.subjectId, id));
    expect(gonefiles.every((f) => f.status === 'deleted')).toBe(true);
    await runDueJobs();
    expect(s.removed).toContain(`private-files/contact/${id}/doc.pdf`);

    // The audit trail is kept, minus the personal fields.
    const history = JSON.stringify(
      await getDb().select().from(changeLog).where(eq(changeLog.subjectId, id)),
    );
    expect(history).not.toContain('pat@example.com');
    expect(history).not.toContain('Likes cats');
    expect(history).not.toContain('Private');
    const created = (await getDb().select().from(activityLog)).find(
      (a) => a.subjectId === id && a.action === 'contacts.create',
    );
    expect(created?.input ?? null).toBeNull();
    await ifEventsEnabled('account.deleted', (e) =>
      expect(e[0]!.data).toMatchObject({ contactId: id, authUserId: 'auth-pat' }),
    );
    // Running again is harmless.
    expect((await runMaintenance()).steps['account.deletions']).toMatchObject({ processed: 0 });
  });

  it('holds back a due request that would remove the last owner, with a note', async () => {
    const owner = await makeActor(['owner']);
    const other = await makeActor(['owner']);
    await ok(callAction(requestDeletion, {}, owner));
    await getDb()
      .update(contacts)
      .set({ status: 'archived' })
      .where(eq(contacts.id, other.contactId!)); // the other owner left meanwhile
    await getDb()
      .update(deletionRequests)
      .set({ scheduledFor: new Date(Date.now() - 1000) });
    expect(await ok(callAction(processDeletions, {}, systemActor()))).toEqual({
      processed: 0,
      skipped: 1,
    });
    expect((await getDb().select().from(deletionRequests))[0]).toMatchObject({
      status: 'pending',
      note: expect.stringContaining('last owner'),
    });
    expect(
      (await getDb().select().from(contacts).where(eq(contacts.id, owner.contactId!)))[0]!.status,
    ).toBe('active');
  });

  it('processDeletions is system only', async () => {
    const owner = await makeActor(['owner']);
    expect(await callAction(processDeletions, {}, owner)).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(await callAction(processDeletions, {}, guestActor())).toMatchObject({
      ok: false,
      error: { code: 'unauthenticated' },
    });
  });
});
