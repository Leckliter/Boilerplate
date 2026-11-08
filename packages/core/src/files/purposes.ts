import type { Permission } from '../access';

/**
 * What a file is for decides where it is stored, what is allowed and who may upload or see it.
 * `access.write` / `access.read` name a permission, or `'self'`: the subject must be the signed-in
 * contact themself (e.g. their own avatar). Public files get a permanent link (`S3_PUBLIC_URL`);
 * private ones are only reachable through short-lived signed links handed out by `files.list`.
 *
 * New purpose? Add it here (and, for a new subject type, to SUBJECTS in actions/files/subjects.ts)
 * — the upload widget, actions and docs follow.
 */
const PHOTOS = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** Phones (iPhone) often shoot HEIC; fine for private records, not for the website. */
const PHONE_PHOTOS = [...PHOTOS, 'image/heic', 'image/heif'] as const;
const DOCUMENTS = [...PHONE_PHOTOS, 'application/pdf'] as const;

const MB = 1024 * 1024;

type Access = Permission | 'self';

export type FilePurpose = {
  label: string;
  /** What the file belongs to, e.g. `contact`. */
  subject: string;
  visibility: 'public' | 'private';
  contentTypes: readonly string[];
  maxBytes: number;
  access: { read: Access; write: Access };
};

export const FILE_PURPOSES = {
  avatar: {
    label: 'Profile photo',
    subject: 'contact',
    visibility: 'public',
    contentTypes: PHOTOS,
    maxBytes: 5 * MB,
    access: { read: 'self', write: 'self' },
  },
  contact_document: {
    label: 'Contact document',
    subject: 'contact',
    visibility: 'private',
    contentTypes: DOCUMENTS,
    maxBytes: 25 * MB,
    access: { read: 'users.read', write: 'users.manage' },
  },
} as const satisfies Record<string, FilePurpose>;

export type FilePurposeKey = keyof typeof FILE_PURPOSES;
export const FILE_PURPOSE_KEYS = Object.keys(FILE_PURPOSES) as FilePurposeKey[];

/**
 * Logical buckets: the first part of every stored object key inside the one S3 bucket (`S3_BUCKET`),
 * and the value of `files.bucket`. A public bucket can live elsewhere (a CDN) via `S3_PUBLIC_URL`.
 */
export const BUCKETS = { public: 'public-files', private: 'private-files' } as const;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'application/pdf': '.pdf',
};

export const extensionFor = (contentType: string) => EXTENSIONS[contentType] ?? '';

export const formatBytes = (n: number) =>
  n >= MB ? `${Math.round((n / MB) * 10) / 10} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
