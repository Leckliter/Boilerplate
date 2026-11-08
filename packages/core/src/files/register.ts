/**
 * Switches the files module on (imported from packages/core/src/modules.ts): the `files.*` actions
 * and the `files.deleteObject` job that maintenance.ts already looks for. Delete this folder,
 * `actions/files`, the line in modules.ts and the upload UI to remove it (docs/files.md).
 */
import { z } from 'zod';

import { registerActions } from '../actions/registry-store';
import { confirmUpload, deleteFile, listFiles, requestUpload } from '../actions/files';
import { defineJob, PermanentJobError, registerJob } from '../jobs';
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
