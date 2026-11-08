import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * S3-compatible object storage — Neon Object Storage, Supabase Storage (S3 protocol), Cloudflare
 * R2, AWS S3, MinIO … Browsers never get our keys: they PUT the bytes to a one-time presigned URL
 * and read private files through short-lived signed URLs. Needs S3_ENDPOINT, S3_BUCKET,
 * S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY (S3_REGION defaults to `auto`); optional
 * S3_PUBLIC_URL (where public files are served, e.g. a CDN) and S3_FORCE_PATH_STYLE=false for
 * virtual-hosted-style endpoints. Without them `getStorage()` is null and uploads say they are
 * not set up. See docs/files.md.
 *
 * An object's key is `<bucket>/<path>` where `bucket` is the logical bucket stored in `files.bucket`
 * (`public-files` / `private-files`, purposes.ts) and `path` is `files.path`.
 */
type ObjectInfo = { sizeBytes: number; contentType: string };

export type Storage = {
  /** A URL the browser can PUT the file to (with exactly this Content-Type), valid for 2 hours. */
  createUploadUrl(bucket: string, path: string, contentType: string): Promise<string>;
  /** Store bytes from the server (e.g. a file an AI agent sent). */
  put(bucket: string, path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** Size and type of an uploaded object, or null when it is not there. */
  stat(bucket: string, path: string): Promise<ObjectInfo | null>;
  /** A link to an object that works for `expiresInSeconds` (at most 7 days). */
  signedUrl(
    bucket: string,
    path: string,
    expiresInSeconds: number,
    downloadAs?: string,
  ): Promise<string>;
  /** The permanent link to a PUBLIC object (S3_PUBLIC_URL), or a 7-day signed link without it. */
  publicUrl(bucket: string, path: string): Promise<string>;
  /** Delete an object (no error if it is already gone). */
  remove(bucket: string, path: string): Promise<void>;
};

export const UPLOAD_URL_SECONDS = 2 * 60 * 60;
const MAX_SIGNED_SECONDS = 7 * 24 * 60 * 60;

const keyOf = (bucket: string, path: string) => `${bucket}/${path}`;

let override: Storage | null | undefined;

/** Tests swap in a fake (`setStorageForTests(fake)`), or `undefined` to restore. */
export function setStorageForTests(storage: Storage | null | undefined) {
  override = storage;
}

let cached: Storage | null | undefined;

/** The configured storage, or null when S3_* is not set. */
export function getStorage(): Storage | null {
  if (override !== undefined) return override;
  if (cached === undefined) cached = fromEnv(process.env);
  return cached;
}

export function storageConfigured(): boolean {
  return getStorage() !== null;
}

/** Exported for tests; `getStorage()` is what the app uses. */
export function fromEnv(env: Record<string, string | undefined>): Storage | null {
  const endpoint = env.S3_ENDPOINT?.trim();
  const bucket = env.S3_BUCKET?.trim();
  const accessKeyId = env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  const client = new S3Client({
    endpoint,
    region: env.S3_REGION?.trim() || 'auto',
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: env.S3_FORCE_PATH_STYLE?.trim().toLowerCase() !== 'false',
  });
  return s3Storage(client, bucket, env.S3_PUBLIC_URL?.trim().replace(/\/$/, '') || null);
}

export function s3Storage(client: S3Client, bucket: string, publicBase: string | null): Storage {
  const signedGet = (key: string, expiresIn: number, downloadAs?: string) =>
    getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ...(downloadAs && {
          ResponseContentDisposition: `attachment; filename="${downloadAs.replace(/["\\\r\n]/g, '_')}"`,
        }),
      }),
      { expiresIn: Math.min(expiresIn, MAX_SIGNED_SECONDS) },
    );
  return {
    createUploadUrl: (b, path, contentType) =>
      getSignedUrl(
        client,
        new PutObjectCommand({ Bucket: bucket, Key: keyOf(b, path), ContentType: contentType }),
        { expiresIn: UPLOAD_URL_SECONDS },
      ),
    async put(b, path, bytes, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: keyOf(b, path),
          Body: bytes,
          ContentType: contentType,
        }),
      );
    },
    async stat(b, path) {
      try {
        const head = await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: keyOf(b, path) }),
        );
        return {
          sizeBytes: Number(head.ContentLength ?? 0),
          contentType: (head.ContentType ?? '').split(';')[0]!.trim(),
        };
      } catch (err) {
        const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
        // Not uploaded (yet): a normal answer, not a failure.
        if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) return null;
        throw err;
      }
    },
    signedUrl: (b, path, expiresInSeconds, downloadAs) =>
      signedGet(keyOf(b, path), expiresInSeconds, downloadAs),
    async publicUrl(b, path) {
      const key = keyOf(b, path);
      return publicBase
        ? `${publicBase}/${key.split('/').map(encodeURIComponent).join('/')}`
        : signedGet(key, MAX_SIGNED_SECONDS);
    },
    async remove(b, path) {
      // S3 answers 204 whether or not the object existed.
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: keyOf(b, path) }));
    },
  };
}
