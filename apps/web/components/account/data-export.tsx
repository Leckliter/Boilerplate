'use client';

import { Button } from '@app/ui/components/button';
import { Callout } from '@app/ui/components/callout';
import { DownloadSimpleIcon } from '@app/ui/components/icons';
import { Progress } from '@app/ui/components/progress';
import { formatDateTime } from '@app/ui/lib/dates';
import { useEffect, useState } from 'react';

import { invokeAction } from '@/lib/invoke';
import { toastActionError } from '@/lib/use-action';

export type ExportFile = { id: string; url: string; filename: string; createdAt: string };

const POLL_MS = 4_000;
/** Stop waiting after this long; the file still arrives (and a notification says so). */
const GIVE_UP_MS = 3 * 60_000;

/**
 * "Download my data" (`account.exportData`): asking queues a background job that builds one JSON file;
 * this polls `files.list` (purpose `data_export`) until the new file appears, then offers the download (a
 * signed link, valid an hour; the file is removed after 7 days). A fresh request replaces the old file, so
 * "ready" means a file newer than the moment you asked.
 */
export function DataExport({
  contactId,
  initial,
  storageReady,
}: {
  contactId: string;
  initial: ExportFile | null;
  storageReady: boolean;
}) {
  const [file, setFile] = useState<ExportFile | null>(initial);
  const [waitingSince, setWaitingSince] = useState<number | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [asking, setAsking] = useState(false);
  // While waiting, ask for the file every few seconds until one newer than the request appears.
  useEffect(() => {
    if (waitingSince === null) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const res = await invokeAction('files.list', {
        purpose: 'data_export',
        subjectId: contactId,
      });
      if (!live) return;
      if (res.ok) {
        const latest = (
          res.data as { id: string; url: string; filename: string; createdAt: string }[]
        )[0];
        if (latest && new Date(latest.createdAt).getTime() >= waitingSince - 2_000) {
          setFile({ ...latest, createdAt: new Date(latest.createdAt).toISOString() });
          setWaitingSince(null);
          return;
        }
      }
      if (Date.now() - waitingSince > GIVE_UP_MS) {
        setGaveUp(true);
        setWaitingSince(null);
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [waitingSince, contactId]);

  async function request() {
    setAsking(true);
    try {
      const res = await invokeAction('account.exportData', {});
      if (!res.ok) return toastActionError(res.error.message, res.error.ref);
      setGaveUp(false);
      setWaitingSince(Date.now());
    } finally {
      setAsking(false);
    }
  }

  const waiting = waitingSince !== null;
  return (
    <div className="grid gap-4">
      {!storageReady && (
        <Callout tone="info">
          Data exports aren’t available on this site yet (file storage isn’t set up). Ask an admin.
        </Callout>
      )}
      {waiting && <Progress label="Preparing your file…" value={null} />}
      {gaveUp && (
        <Callout tone="info">
          It’s taking longer than usual. You’ll get a notification when your file is ready, and it
          will appear here.
        </Callout>
      )}
      {file && !waiting && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-tint p-3">
          <div className="min-w-0 flex-1 basis-48">
            <p className="text-sm font-medium">Your data is ready</p>
            <p className="text-xs text-muted-foreground">
              Made {formatDateTime(file.createdAt)}. The file is removed after 7 days.
            </p>
          </div>
          <a
            href={file.url}
            download={file.filename}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <DownloadSimpleIcon className="size-4" /> Download
          </a>
        </div>
      )}
      <div>
        <Button loading={asking || waiting} disabled={!storageReady} onClick={request}>
          {file ? 'Make a new copy' : 'Request a copy'}
        </Button>
      </div>
    </div>
  );
}
