/**
 * Switches the account-data module on (imported from packages/core/src/modules.ts): "download my
 * data" (`account.exportData`, a background job that writes a private JSON file through the files
 * module) and "delete my account" (`account.requestDeletion` / `cancelDeletion`, then the daily
 * maintenance step anonymises after the grace period). Needs the files module for exports.
 * To remove it: delete this folder, `actions/account/data.ts`, the line in modules.ts, the
 * `account.*` events/notification types and the privacy screen.
 */
import { randomUUID } from 'node:crypto';

import { and, eq, files, getDb, lt } from '@app/db';
import { z } from 'zod';

import { systemActor } from '../access/actor';
import {
  cancelDeletion,
  deletionStatus,
  exportData,
  exportPayload,
  processDeletions,
  recordExport,
  requestDeletion,
} from '../actions/account/data';
import { callAction } from '../actions/run';
import { registerActions } from '../actions/registry-store';
import { BUCKETS } from '../files/purposes';
import { getStorage } from '../files/s3';
import { defineJob, enqueue, getJob, PermanentJobError, registerJob } from '../jobs';
import { registerMaintenanceStep } from '../maintenance-steps';

registerActions(
  exportData,
  exportPayload,
  recordExport,
  requestDeletion,
  cancelDeletion,
  deletionStatus,
  processDeletions,
);

/** An export file is kept this long, then removed by the daily step. */
export const EXPORT_RETENTION_DAYS = 7;

registerJob(
  defineJob({
    type: 'account.exportData',
    description:
      'Build a person’s data export (JSON), store it as a private file and notify them. Safe to repeat: a newer export replaces the older.',
    payload: z.object({ contactId: z.uuid() }),
    maxAttempts: 5,
    run: async ({ contactId }) => {
      const storage = getStorage();
      if (!storage) throw new PermanentJobError('File storage (S3_*) is not configured here.');
      const system = systemActor();
      const data = await callAction(exportPayload, { contactId }, system);
      if (!data.ok) throw new Error(data.error.message);
      const bytes = new TextEncoder().encode(JSON.stringify(data.data, null, 2));
      const fileId = randomUUID();
      const path = `contact/${contactId}/${fileId}.json`;
      const filename = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
      await storage.put(BUCKETS.private, path, bytes, 'application/json');
      const done = await callAction(
        recordExport,
        { contactId, fileId, bucket: BUCKETS.private, path, filename, sizeBytes: bytes.length },
        system,
      );
      if (!done.ok) {
        // The file was stored but not recorded: remove it so a retry starts clean.
        await storage.remove(BUCKETS.private, path);
        throw new Error(done.error.message);
      }
      return { contactId, sizeBytes: bytes.length };
    },
  }),
);

registerMaintenanceStep('account.deletions', async (now) => {
  const result = await callAction(processDeletions, { limit: 25 }, systemActor());
  if (!result.ok) throw new Error(result.error.message);
  // Exports are removed after a week (the bytes through the files module's job).
  const old = await getDb().transaction(async (tx) => {
    const rows = await tx
      .update(files)
      .set({ status: 'deleted' })
      .where(
        and(
          eq(files.purpose, 'data_export'),
          eq(files.status, 'ready'),
          lt(files.createdAt, new Date(now.getTime() - EXPORT_RETENTION_DAYS * 86_400_000)),
        ),
      )
      .returning({ bucket: files.bucket, path: files.path });
    if (getJob('files.deleteObject'))
      for (const f of rows) await enqueue(tx, 'files.deleteObject', f);
    return rows.length;
  });
  return { ...result.data, exportsRemoved: old };
});
