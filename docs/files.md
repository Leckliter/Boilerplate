# Files

Uploads go browser → storage directly. `files.requestUpload` checks purpose, type and size and returns a
presigned `PUT` URL; the browser sends the bytes with the same `Content-Type`; `files.confirm` checks what
was really stored (size, type) and marks the file ready, or refuses and removes it. `files.list` returns
files with URLs (private ones: signed, valid an hour); `files.delete` marks it deleted and queues the
`files.deleteObject` job. Uploads never confirmed are abandoned after 24 h by the maintenance job.

- **Storage:** any S3-compatible service (Neon, Supabase, R2, S3, MinIO): `packages/core/src/files/s3.ts`.
  Env: `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, optional `S3_REGION`,
  `S3_PUBLIC_URL` (where public files are served), `S3_FORCE_PATH_STYLE=false`. Keys are
  `<public-files|private-files>/<subject>/<id>/<file id>.<ext>` inside the one bucket.
- **Purposes** (`files/purposes.ts`): `avatar` (public, yourself) and `contact_document` (private,
  `users.manage` / `users.read`). Add yours there and a subject check in `actions/files/subjects.ts`.
- **Removing it:** delete `files/`, `actions/files`, the `modules.ts` line; maintenance skips the job when absent.
