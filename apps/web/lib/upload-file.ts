import { invokeAction } from './invoke';

export type UploadedFile = {
  id: string;
  purpose: string;
  filename: string;
  contentType: string;
  sizeBytes: number | null;
  caption: string | null;
  isImage: boolean;
  public: boolean;
  createdAt: Date | string;
  url: string;
};

export type UploadResult =
  { ok: true; file: UploadedFile } | { ok: false; message: string; ref?: string };

/**
 * Send one file browser → storage (docs/files.md): `files.requestUpload` (checks type and size, returns a
 * presigned URL), a PUT with progress, then `files.confirm`. Never throws: the result says what went wrong.
 */
export async function uploadFile(opts: {
  purpose: string;
  subjectId: string;
  file: File;
  caption?: string;
  onProgress?: (percent: number) => void;
}): Promise<UploadResult> {
  const { file } = opts;
  const started = await invokeAction('files.requestUpload', {
    purpose: opts.purpose,
    subjectId: opts.subjectId,
    filename: file.name,
    contentType: file.type,
    sizeBytes: file.size,
    ...(opts.caption && { caption: opts.caption }),
  });
  if (!started.ok) return { ok: false, message: started.error.message, ref: started.error.ref };
  const { fileId, uploadUrl, headers } = started.data as {
    fileId: string;
    uploadUrl: string;
    headers: Record<string, string>;
  };

  const put = await new Promise<string | null>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      resolve(xhr.status >= 200 && xhr.status < 300 ? null : `Storage said ${xhr.status}.`);
    xhr.onerror = () => resolve('The upload was interrupted. Check your connection and try again.');
    xhr.send(file);
  });
  if (put) return { ok: false, message: put };

  const done = await invokeAction('files.confirm', { fileId });
  if (!done.ok) return { ok: false, message: done.error.message, ref: done.error.ref };
  const { file: view, rejected } = done.data as {
    file: UploadedFile | null;
    rejected: string | null;
  };
  if (!view) return { ok: false, message: rejected ?? 'The file was refused.' };
  return { ok: true, file: view };
}
