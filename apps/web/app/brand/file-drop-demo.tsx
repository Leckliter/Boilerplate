'use client';

import { FileDrop } from '@app/ui/components/file-drop';
import { toast } from '@app/ui/components/toaster';

export function FileDropDemo() {
  return (
    <FileDrop
      className="max-w-md"
      accept="image/*,application/pdf"
      hint="JPG, PNG or PDF, up to 25 MB"
      onFiles={(files) => toast.success(`Picked ${files.map((f) => f.name).join(', ')}`)}
    />
  );
}
