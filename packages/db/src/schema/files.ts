import { sql } from 'drizzle-orm';
import { bigint, index, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { contacts } from './contacts';
import { app, createdAt, id, updatedAt } from './_shared';

/**
 * Uploaded files (photos, documents). The bytes live in S3-compatible storage (Neon or Supabase); this
 * table says what each file is, what it belongs to and who uploaded it.
 * See docs/files.md.
 *
 * `purpose` decides everything else — which bucket (public or private), which
 * types and sizes are allowed, and which permission may upload or see it
 * (packages/core/src/files/purposes.ts, owned by the files module).
 */
export const fileStatus = app.enum('file_status', [
  'pending', // upload URL handed out, bytes not confirmed yet
  'ready', // uploaded and checked
  'deleted', // removed (the row stays for history; the bytes are deleted)
]);

export const files = app
  .table(
    'files',
    {
      id: id(),
      /** e.g. `avatar`, `contact_document` (see purposes.ts). */
      purpose: text('purpose').notNull(),
      /** What it belongs to: `contact`, `report` …. */
      subjectType: text('subject_type').notNull(),
      subjectId: uuid('subject_id').notNull(),
      /** Storage bucket and object path, e.g. `public-files` + `contact/<id>/<file id>.jpg`. */
      bucket: text('bucket').notNull(),
      path: text('path').notNull(),
      /** The name it had on the uploader's device. */
      filename: text('filename').notNull(),
      contentType: text('content_type').notNull(),
      sizeBytes: bigint('size_bytes', { mode: 'number' }),
      status: fileStatus('status').notNull().default('pending'),
      /** Optional caption, e.g. "Signed contract, page 2". */
      caption: text('caption'),
      uploadedByContactId: uuid('uploaded_by_contact_id').references(() => contacts.id, {
        onDelete: 'set null',
      }),
      createdAt: createdAt(),
      updatedAt: updatedAt(),
    },
    (t) => [
      index('files_subject_idx').on(t.subjectType, t.subjectId, t.createdAt),
      uniqueIndex('files_bucket_path_key').on(t.bucket, t.path),
      index('files_pending_idx')
        .on(t.createdAt)
        .where(sql`${t.status} = 'pending'`),
    ],
  )
  .enableRLS();

export type FileRow = typeof files.$inferSelect;
