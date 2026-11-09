import { and, desc, eq, type FileRow, files, type Tx } from '@app/db';
import { z } from 'zod';

import {
  BUCKETS,
  extensionFor,
  FILE_PURPOSE_KEYS,
  FILE_PURPOSES,
  type FilePurposeKey,
  formatBytes,
} from '../../files/purposes';
import { getStorage, type Storage } from '../../files/s3';
import { enqueue } from '../../jobs';
import { ActionError, defineAction } from '../define';
import { requireFileAccess, subjectLabel } from './subjects';

const purposeField = z
  .enum(FILE_PURPOSE_KEYS as [FilePurposeKey, ...FilePurposeKey[]])
  .describe(
    'What the file is: avatar (a contact’s public profile photo; only yourself or staff with users.manage) or ' +
      'contact_document (private paperwork on a contact; users.manage to add, users.read to see) or ' +
      'data_export (a person’s own data export, made by account.exportData; cannot be uploaded).',
  );

/** How long a private file's link works. */
const SIGNED_URL_SECONDS = 60 * 60;

function storageOrThrow(): Storage {
  const storage = getStorage();
  if (!storage) {
    throw new ActionError(
      'conflict',
      'File uploads aren’t set up here yet (S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are missing).',
    );
  }
  return storage;
}

async function fileOrThrow(tx: Tx, id: string): Promise<FileRow> {
  const [f] = await tx.select().from(files).where(eq(files.id, id));
  if (!f || f.status === 'deleted') throw new ActionError('not_found', 'File not found.');
  return f;
}

const purposeOf = (f: FileRow) => {
  const purpose = FILE_PURPOSES[f.purpose as FilePurposeKey];
  if (!purpose) throw new ActionError('invalid_input', `Unknown file purpose ${f.purpose}.`);
  return purpose;
};

export const requestUpload = defineAction({
  name: 'files.requestUpload',
  title: 'Start a file upload',
  description:
    'Step 1 of uploading a photo or document to a record: checks the type and size, and returns `uploadUrl`. ' +
    'PUT the raw bytes there with the same Content-Type header (within 2 hours), then call files.confirm. ' +
    'Needs permission to add files of that purpose to that record.',
  audience: 'authenticated',
  mutates: true,
  rateLimit: { limit: 120, perSeconds: 60 * 60 },
  returns: '{ fileId, uploadUrl, method: "PUT", headers }',
  input: z.object({
    purpose: purposeField,
    subjectId: z
      .uuid()
      .describe('The record the file belongs to (a contact id for avatar / contact_document).'),
    filename: z.string().trim().min(1).max(200),
    contentType: z.string().trim().toLowerCase(),
    sizeBytes: z.number().int().min(1),
    caption: z.string().trim().max(500).optional(),
  }),
  async run({ input, actor, tx, log }) {
    const purpose = FILE_PURPOSES[input.purpose];
    if ('systemOnly' in purpose && purpose.systemOnly) {
      throw new ActionError(
        'forbidden',
        `${purpose.label}s are created by the system, not uploaded.`,
      );
    }
    requireFileAccess(actor, purpose, 'write', input.subjectId);
    const about = await subjectLabel(tx, purpose.subject, input.subjectId);
    if (!(purpose.contentTypes as readonly string[]).includes(input.contentType)) {
      throw new ActionError(
        'invalid_input',
        `${purpose.label}s can be ${purpose.contentTypes.map((t) => t.split('/')[1]!.toUpperCase()).join(', ')} — not ${input.contentType || 'this type'}.`,
      );
    }
    if (input.sizeBytes > purpose.maxBytes) {
      throw new ActionError(
        'invalid_input',
        `That file is ${formatBytes(input.sizeBytes)}; the limit is ${formatBytes(purpose.maxBytes)}.`,
      );
    }
    const storage = storageOrThrow();
    const bucket = BUCKETS[purpose.visibility];
    const id = crypto.randomUUID();
    const path = `${purpose.subject}/${input.subjectId}/${id}${extensionFor(input.contentType)}`;
    await tx.insert(files).values({
      id,
      purpose: input.purpose,
      subjectType: purpose.subject,
      subjectId: input.subjectId,
      bucket,
      path,
      filename: input.filename,
      contentType: input.contentType,
      caption: input.caption ?? null,
      uploadedByContactId: actor.contactId,
    });
    const uploadUrl = await storage.createUploadUrl(bucket, path, input.contentType);
    log({
      subjectType: purpose.subject,
      subjectId: input.subjectId,
      summary: `Started uploading ${input.filename} (${purpose.label.toLowerCase()}) to ${about}`,
    });
    return {
      fileId: id,
      uploadUrl,
      method: 'PUT' as const,
      headers: { 'Content-Type': input.contentType },
    };
  },
});

export const confirmUpload = defineAction({
  name: 'files.confirm',
  title: 'Finish a file upload',
  description:
    'Step 2: confirm the bytes arrived and match the declared type and size limit. Returns the file with its ' +
    'URL — or `rejected` saying why the stored file was refused (and removed).',
  audience: 'authenticated',
  mutates: true,
  returns: '{ file: FileView | null, rejected: string | null }',
  input: z.object({ fileId: z.uuid() }),
  async run({ input, actor, tx, log }) {
    const f = await fileOrThrow(tx, input.fileId);
    const purpose = purposeOf(f);
    requireFileAccess(actor, purpose, 'write', f.subjectId);
    if (f.status === 'ready') return { file: await view(storageOrThrow(), f), rejected: null };
    if (actor.kind !== 'system' && f.uploadedByContactId !== actor.contactId) {
      throw new ActionError('forbidden', 'Only the person who started this upload can finish it.');
    }
    const storage = storageOrThrow();
    const info = await storage.stat(f.bucket, f.path);
    if (!info) {
      throw new ActionError(
        'invalid_input',
        'The file hasn’t arrived yet — upload it, then try again.',
      );
    }
    // The browser said one thing; check what was actually stored.
    const problem =
      info.sizeBytes > purpose.maxBytes
        ? `it is ${formatBytes(info.sizeBytes)} (limit ${formatBytes(purpose.maxBytes)})`
        : info.contentType && info.contentType !== f.contentType
          ? `it was stored as ${info.contentType}, not ${f.contentType}`
          : null;
    if (problem) {
      await tx.update(files).set({ status: 'deleted' }).where(eq(files.id, f.id));
      await enqueue(tx, 'files.deleteObject', { bucket: f.bucket, path: f.path });
      log({
        subjectType: f.subjectType,
        subjectId: f.subjectId,
        summary: `Rejected ${f.filename}: ${problem}`,
      });
      return { file: null, rejected: `That file was refused: ${problem}.` };
    }
    const [ready] = await tx
      .update(files)
      .set({ status: 'ready', sizeBytes: info.sizeBytes })
      .where(eq(files.id, f.id))
      .returning();
    log({
      subjectType: f.subjectType,
      subjectId: f.subjectId,
      summary: `Uploaded ${f.filename} (${purpose.label.toLowerCase()})`,
    });
    return { file: await view(storage, ready!), rejected: null };
  },
});

export const listFiles = defineAction({
  name: 'files.list',
  title: 'List files',
  description:
    'Photos and documents attached to a record, newest first, each with a `url` (private files: a signed link ' +
    'that works for an hour). Only files you may see are returned; ask for one purpose at a time.',
  audience: 'authenticated',
  mutates: false,
  returns: '[FileView]',
  input: z.object({
    purpose: purposeField,
    subjectId: z.uuid().describe('The record, e.g. a contact id.'),
  }),
  async run({ input, actor, tx }) {
    const purpose = FILE_PURPOSES[input.purpose];
    requireFileAccess(actor, purpose, 'read', input.subjectId);
    const rows = await tx
      .select()
      .from(files)
      .where(
        and(
          eq(files.subjectType, purpose.subject),
          eq(files.subjectId, input.subjectId),
          eq(files.purpose, input.purpose),
          eq(files.status, 'ready'),
        ),
      )
      .orderBy(desc(files.createdAt))
      .limit(200);
    if (!rows.length) return [];
    const storage = storageOrThrow();
    return Promise.all(rows.map((f) => view(storage, f)));
  },
});

export const deleteFile = defineAction({
  name: 'files.delete',
  title: 'Delete a file',
  description:
    'Remove a photo or document from a record. The record of the upload stays in the history; the bytes are ' +
    'deleted in the background (job files.deleteObject).',
  audience: 'authenticated',
  mutates: true,
  destructive: true,
  returns: '{ id }',
  input: z.object({ fileId: z.uuid() }),
  async run({ input, actor, tx, log }) {
    const f = await fileOrThrow(tx, input.fileId);
    requireFileAccess(actor, purposeOf(f), 'write', f.subjectId);
    await tx.update(files).set({ status: 'deleted' }).where(eq(files.id, f.id));
    await enqueue(tx, 'files.deleteObject', { bucket: f.bucket, path: f.path });
    log({ subjectType: f.subjectType, subjectId: f.subjectId, summary: `Deleted ${f.filename}` });
    return { id: f.id };
  },
});

export type FileView = Awaited<ReturnType<typeof view>>;

async function view(storage: Storage, f: FileRow) {
  return {
    id: f.id,
    purpose: f.purpose,
    subjectType: f.subjectType,
    subjectId: f.subjectId,
    filename: f.filename,
    contentType: f.contentType,
    sizeBytes: f.sizeBytes,
    caption: f.caption,
    isImage: f.contentType.startsWith('image/'),
    public: f.bucket === BUCKETS.public,
    createdAt: f.createdAt,
    url:
      f.bucket === BUCKETS.public
        ? await storage.publicUrl(f.bucket, f.path)
        : await storage.signedUrl(f.bucket, f.path, SIGNED_URL_SECONDS),
  };
}
