'use client';

import { confirm } from '@app/ui/components/alert-dialog';
import { Button } from '@app/ui/components/button';
import { Empty } from '@app/ui/components/empty';
import { FileDrop } from '@app/ui/components/file-drop';
import { DownloadSimpleIcon, FileTextIcon, TrashIcon } from '@app/ui/components/icons';
import { useDates } from '@app/ui/components/ui-context';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useAction } from '@/lib/use-action';
import { uploadFile } from '@/lib/upload-file';

export type FileRow = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number | null;
  isImage: boolean;
  url: string;
  createdAt: string;
  caption: string | null;
};

const kb = (n: number | null) =>
  n === null
    ? ''
    : n > 1_048_576
      ? `${(n / 1_048_576).toFixed(1)} MB`
      : `${Math.max(1, Math.round(n / 1024))} KB`;

/**
 * A contact's private documents (`contact_document`): drop files to send them browser → storage with a
 * progress bar (`files.requestUpload` → PUT → `files.confirm`), see them, open them (signed links, valid an
 * hour) and delete them (`files.delete`, asks first). `canWrite` hides the upload and delete controls.
 */
export function UserFiles({
  contactId,
  files,
  canWrite,
}: {
  contactId: string;
  files: FileRow[];
  canWrite: boolean;
}) {
  const { formatDateTime } = useDates();
  const router = useRouter();
  const { run } = useAction();
  const [state, setState] = useState<{
    status: 'idle' | 'uploading' | 'success' | 'error';
    progress?: number;
    message?: string;
  }>({ status: 'idle' });

  async function send(picked: File[]) {
    let done = 0;
    for (const file of picked) {
      setState({ status: 'uploading', progress: 0, message: `Uploading ${file.name}…` });
      const res = await uploadFile({
        purpose: 'contact_document',
        subjectId: contactId,
        file,
        onProgress: (progress) =>
          setState({ status: 'uploading', progress, message: `Uploading ${file.name}…` }),
      });
      if (!res.ok) {
        setState({
          status: 'error',
          message: `${file.name}: ${res.message}${res.ref ? ` (${res.ref})` : ''}`,
        });
        router.refresh();
        return;
      }
      done++;
    }
    setState({ status: 'success', message: `Uploaded ${done} ${done === 1 ? 'file' : 'files'}.` });
    router.refresh();
  }

  async function remove(f: FileRow) {
    const ok = await confirm({
      title: `Delete ${f.filename}?`,
      description: 'The file is removed for everyone. This can’t be undone.',
      confirmLabel: 'Delete file',
    });
    if (ok) await run('files.delete', { fileId: f.id }, { success: 'File deleted' });
  }

  return (
    <div className="grid gap-4">
      {canWrite && (
        <FileDrop
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
          hint="Photos and PDFs, up to 25 MB each"
          onFiles={send}
          status={state.status}
          progress={state.progress}
          message={state.message}
        />
      )}
      {files.length === 0 ? (
        <Empty
          size="sm"
          icon={<FileTextIcon />}
          title="No documents yet"
          description={
            canWrite
              ? 'Drop a file above to attach it to this person.'
              : 'Nothing has been attached.'
          }
        />
      ) : (
        <ul className="divide-y divide-hairline rounded-lg bg-card ring ring-border">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              {f.isImage ? (
                // A signed link to the person's own upload; next/image would need the storage host allow-listed.
                <img src={f.url} alt="" className="size-10 shrink-0 rounded-md object-cover" />
              ) : (
                <FileTextIcon
                  aria-hidden
                  className="size-10 shrink-0 rounded-md bg-fill p-2 text-muted-foreground"
                />
              )}
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-sm font-medium">{f.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {[kb(f.sizeBytes), formatDateTime(f.createdAt)].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex gap-1">
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${f.filename}`}
                  className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-tint hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <DownloadSimpleIcon className="size-4" />
                </a>
                {canWrite && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete ${f.filename}`}
                    onClick={() => remove(f)}
                  >
                    <TrashIcon />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
