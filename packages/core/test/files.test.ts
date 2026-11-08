import { eq, files, getDb, jobs } from '@app/db';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { systemActor } from '../src/access';
import { callAction } from '../src/actions';
import { confirmUpload, deleteFile, listFiles, requestUpload } from '../src/actions/files';
import { fromEnv, setStorageForTests, type Storage } from '../src/files/s3';
import { runDueJobs } from '../src/jobs';
import { runMaintenance } from '../src/maintenance';
import { assertLocalDatabase, makeActor, resetDatabase } from './setup';

beforeAll(assertLocalDatabase);
beforeEach(resetDatabase);
afterEach(() => setStorageForTests(undefined));

/** In-memory storage: what the browser PUT is whatever the test says it is. */
function fakeStorage() {
  const objects = new Map<string, { sizeBytes: number; contentType: string }>();
  const removed: string[] = [];
  const key = (b: string, p: string) => `${b}/${p}`;
  const storage: Storage = {
    createUploadUrl: async (b, p) => `https://s3.test/${key(b, p)}?sig=1`,
    put: async (b, p, bytes, contentType) =>
      void objects.set(key(b, p), { sizeBytes: bytes.length, contentType }),
    stat: async (b, p) => objects.get(key(b, p)) ?? null,
    signedUrl: async (b, p) => `https://s3.test/${key(b, p)}?signed=1`,
    publicUrl: async (b, p) => `https://cdn.test/${key(b, p)}`,
    remove: async (b, p) => void removed.push(key(b, p)),
  };
  setStorageForTests(storage);
  return { objects, removed, key };
}

const base = (subjectId: string, over: object = {}) => ({
  purpose: 'contact_document' as const,
  subjectId,
  filename: 'lease.pdf',
  contentType: 'application/pdf',
  sizeBytes: 1000,
  ...over,
});

describe('files: upload flow', () => {
  it('request → PUT → confirm → list → delete (bytes removed by a job)', async () => {
    const s = fakeStorage();
    const manager = await makeActor(['manager']);
    const target = await makeActor([]);
    const req = await callAction(requestUpload, base(target.contactId!), manager);
    if (!req.ok) throw new Error(req.error.message);
    expect(req.data).toMatchObject({
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
    });
    expect(req.data.uploadUrl).toContain('private-files/contact/');
    // Not uploaded yet.
    expect(await callAction(confirmUpload, { fileId: req.data.fileId }, manager)).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
    const [row] = await getDb().select().from(files);
    s.objects.set(s.key(row!.bucket, row!.path), {
      sizeBytes: 1000,
      contentType: 'application/pdf',
    });
    const done = await callAction(confirmUpload, { fileId: req.data.fileId }, manager);
    expect(done).toMatchObject({
      ok: true,
      data: { rejected: null, file: { sizeBytes: 1000, public: false } },
    });
    const list = await callAction(
      listFiles,
      { purpose: 'contact_document', subjectId: target.contactId! },
      manager,
    );
    expect(list).toMatchObject({ ok: true, data: [{ filename: 'lease.pdf' }] });
    expect(list.ok && list.data[0]!.url).toContain('signed=1');
    expect(await callAction(deleteFile, { fileId: req.data.fileId }, manager)).toMatchObject({
      ok: true,
    });
    await runDueJobs();
    expect(s.removed).toEqual([s.key(row!.bucket, row!.path)]);
    expect(
      (await getDb().select().from(jobs).where(eq(jobs.type, 'files.deleteObject')))[0]!.status,
    ).toBe('done');
  });

  it('refuses a stored file that is the wrong size or type, and removes it', async () => {
    const s = fakeStorage();
    const manager = await makeActor(['manager']);
    const target = await makeActor([]);
    const req = await callAction(requestUpload, base(target.contactId!), manager);
    if (!req.ok) throw new Error('x');
    const [row] = await getDb().select().from(files);
    s.objects.set(s.key(row!.bucket, row!.path), { sizeBytes: 1000, contentType: 'text/html' });
    const res = await callAction(confirmUpload, { fileId: req.data.fileId }, manager);
    expect(res).toMatchObject({ ok: true, data: { file: null } });
    expect(res.ok && res.data.rejected).toContain('text/html');
    await runDueJobs();
    expect(s.removed).toHaveLength(1);
  });

  it('checks type, size, subject and who may upload', async () => {
    fakeStorage();
    const manager = await makeActor(['manager']);
    const staff = await makeActor(['staff']);
    const customer = await makeActor([]);
    const id = customer.contactId!;
    expect(
      await callAction(requestUpload, base(id, { contentType: 'text/html' }), manager),
    ).toMatchObject({ ok: false, error: { code: 'invalid_input' } });
    expect(
      await callAction(requestUpload, base(id, { sizeBytes: 999_999_999 }), manager),
    ).toMatchObject({ ok: false, error: { code: 'invalid_input' } });
    expect(await callAction(requestUpload, base(crypto.randomUUID()), manager)).toMatchObject({
      ok: false,
      error: { code: 'not_found' },
    });
    // staff can read people but not add paperwork; a customer cannot upload paperwork on themselves.
    expect(await callAction(requestUpload, base(id), staff)).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(await callAction(requestUpload, base(id), customer)).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(
      await callAction(listFiles, { purpose: 'contact_document', subjectId: id }, customer),
    ).toMatchObject({ ok: false, error: { code: 'forbidden' } });
    // …but they can add their own public avatar, and nobody else's.
    const mine = await callAction(
      requestUpload,
      base(id, { purpose: 'avatar', contentType: 'image/png', filename: 'me.png' }),
      customer,
    );
    expect(mine).toMatchObject({ ok: true });
    const other = await makeActor([]);
    expect(
      await callAction(
        requestUpload,
        base(id, { purpose: 'avatar', contentType: 'image/png' }),
        other,
      ),
    ).toMatchObject({ ok: false, error: { code: 'forbidden' } });
    const row = (await getDb().select().from(files))[0]!;
    expect(row.bucket).toBe('public-files');
    expect(await callAction(deleteFile, { fileId: row.id }, other)).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
  });

  it('says so when storage is not configured; maintenance abandons stale uploads', async () => {
    setStorageForTests(null);
    const manager = await makeActor(['manager']);
    const target = await makeActor([]);
    expect(await callAction(requestUpload, base(target.contactId!), manager)).toMatchObject({
      ok: false,
      error: { code: 'conflict' },
    });
    const s = fakeStorage();
    await callAction(requestUpload, base(target.contactId!), manager);
    await getDb()
      .update(files)
      .set({ createdAt: new Date(Date.now() - 3 * 86_400_000) });
    expect((await runMaintenance()).abandonedUploads).toBe(1);
    await runDueJobs();
    expect(s.removed).toHaveLength(1);
    // The system can finish any upload, e.g. one started by an AI agent.
    void systemActor;
  });

  it('builds a client only when every S3_* variable is set', () => {
    expect(fromEnv({})).toBeNull();
    expect(fromEnv({ S3_ENDPOINT: 'https://s3.test', S3_BUCKET: 'b' })).toBeNull();
    expect(
      fromEnv({
        S3_ENDPOINT: 'https://s3.test',
        S3_BUCKET: 'b',
        S3_ACCESS_KEY_ID: 'k',
        S3_SECRET_ACCESS_KEY: 's',
      }),
    ).not.toBeNull();
  });

  it('presigns a PUT url that names the bucket, key and content type', async () => {
    const storage = fromEnv({
      S3_ENDPOINT: 'https://s3.test',
      S3_BUCKET: 'bkt',
      S3_ACCESS_KEY_ID: 'k',
      S3_SECRET_ACCESS_KEY: 's',
      S3_PUBLIC_URL: 'https://cdn.test/',
    })!;
    const url = await storage.createUploadUrl(
      'private-files',
      'contact/1/a.pdf',
      'application/pdf',
    );
    expect(url).toContain('https://s3.test/bkt/private-files/contact/1/a.pdf');
    expect(url).toContain('X-Amz-Signature');
    expect(await storage.publicUrl('public-files', 'contact/1/a b.png')).toBe(
      'https://cdn.test/public-files/contact/1/a%20b.png',
    );
  });
});
