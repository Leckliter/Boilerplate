'use client';

import { AvatarUpload } from '@app/ui/components/avatar-upload';
import { toast } from '@app/ui/components/toaster';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { toastActionError } from '@/lib/use-action';
import { invokeAction } from '@/lib/invoke';
import { uploadFile } from '@/lib/upload-file';

/**
 * A contact's profile photo (the `avatar` file purpose; docs/files.md). Choosing a photo uploads it
 * browser → storage (`files.requestUpload` → PUT → `files.confirm`), then the older photos are removed
 * (`files.delete`), so there is always at most one. "Remove" deletes it. `src` is the current public URL.
 * Used for yourself (Account → Profile) and by staff on a user's page.
 */
export function AvatarEditor({
  contactId,
  name,
  src,
  oldIds,
  storageReady,
}: {
  contactId: string;
  name: string;
  src: string | null;
  /** Ids of every avatar file the contact has now (replaced or removed on change). */
  oldIds: string[];
  storageReady: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function change(file: File | null) {
    setBusy(true);
    try {
      let ok = true;
      if (file) {
        const res = await uploadFile({ purpose: 'avatar', subjectId: contactId, file });
        if (!res.ok) {
          toastActionError(res.message, res.ref);
          ok = false;
        }
      }
      if (ok) {
        for (const fileId of oldIds) {
          const gone = await invokeAction('files.delete', { fileId });
          if (!gone.ok) toastActionError(gone.error.message, gone.error.ref);
        }
        toast.success(file ? 'Photo updated' : 'Photo removed');
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <AvatarUpload name={name} src={src} onChange={change} disabled={busy || !storageReady} />
      {!storageReady && (
        <p className="text-sm text-muted-foreground">
          Photos need file storage, which isn’t set up here yet (see Admin → Settings →
          Integrations).
        </p>
      )}
    </div>
  );
}
