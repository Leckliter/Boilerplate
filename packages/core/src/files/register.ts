/**
 * Switches the files module on (imported from packages/core/src/modules.ts): the `files.*` actions
 * and the `files.deleteObject` job that maintenance.ts already looks for. Delete this folder,
 * `actions/files`, the line in modules.ts and the upload UI to remove it (docs/files.md).
 */
import { and, eq, files, getDb, lt } from '@app/db';
import { z } from 'zod';

import { registerActions } from '../actions/registry-store';
import { confirmUpload, deleteFile, listFiles, requestUpload } from '../actions/files';
import { defineJob, enqueue, PermanentJobError, registerJob } from '../jobs';
import { registerMaintenanceStep } from '../maintenance-steps';
import { getStorage } from './s3';

registerActions(requestUpload, confirmUpload, listFiles, deleteFile);

registerJob(
  defineJob({
    type: 'files.deleteObject',
    description:
      'Delete a stored file’s bytes after its record was deleted, rejected or abandoned. Safe to repeat.',
    payload: z.object({ bucket: z.string(), path: z.string() }),
    maxAttempts: 8,
    run: async ({ bucket, path }) => {
      const storage = getStorage();
      if (!storage) throw new PermanentJobError('File storage (S3_*) is not configured here.');
      await storage.remove(bucket, path);
      return { bucket, path };
    },
  }),
);

/** An upload that was started but never finished is abandoned after this. */
const ABANDONED_UPLOAD_HOURS = 24;

// Daily cleanup (runMaintenance): mark never-finished uploads deleted and queue removal of their bytes.
registerMaintenanceStep('files.abandoned', async (now) => {
  const abandonedUploads = await getDb().transaction(async (tx) => {
    const rows = await tx
      .update(files)
      .set({ status: 'deleted' })
      .where(
        and(
          eq(files.status, 'pending'),
          lt(files.createdAt, new Date(now.getTime() - ABANDONED_UPLOAD_HOURS * 3_600_000)),
        ),
      )
      .returning({ bucket: files.bucket, path: files.path });
    for (const f of rows) await enqueue(tx, 'files.deleteObject', f);
    return rows.length;
  });
  return { abandonedUploads };
});
