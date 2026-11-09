# Files

Uploads go browser → storage directly. `files.requestUpload` checks purpose, type and size and returns a
presigned `PUT` URL; the browser sends the bytes with the same `Content-Type`; `files.confirm` checks what
was really stored (size, type) and marks the file ready, or refuses and removes it. `files.list` returns
files with URLs (private ones: signed, valid an hour); `files.delete` marks it deleted and queues the
`files.deleteObject` job. Server code can store bytes itself with `getStorage().put(bucket, path, bytes, type)`
(the data export job does) and register the row through a system action. Uploads never confirmed are abandoned after 24 h by the maintenance job.

- **Storage:** any S3-compatible service (Neon, Supabase, R2, S3, MinIO): `packages/core/src/files/s3.ts`.
  Env: `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, optional `S3_REGION`,
  `S3_PUBLIC_URL` (where public files are served), `S3_FORCE_PATH_STYLE=false`. Keys are
  `<public-files|private-files>/<subject>/<id>/<file id>.<ext>` inside the one bucket.
- **Purposes** (`files/purposes.ts`): `avatar` (public, yourself), `contact_document` (private,
  `users.manage` / `users.read`) and `data_export` (private; created only by `account.exportData`, so
  `files.requestUpload` refuses it, and readable only by the person it is about — access `'self-only'`, not even staff;
  removed after 7 days). Access is a permission, `'self'` (the contact themself or `users.manage`) or `'self-only'`.
  Add yours there and a subject check in `actions/files/subjects.ts`.
- **Removing it:** delete `files/`, `actions/files`, the `modules.ts` line; its daily `files.abandoned` maintenance step and the job go with it.
