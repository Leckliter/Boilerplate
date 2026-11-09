'use client';

import { Button } from '@app/ui/components/button';
import { DownloadSimpleIcon } from '@app/ui/components/icons';
import { toast } from '@app/ui/components/toaster';
import { useState } from 'react';

import { toastActionError } from '@/lib/use-action';
import { downloadText } from '@/lib/download';
import { invokeAction } from '@/lib/invoke';

/** What `contacts.exportCsv` / `activity.exportCsv` return. */
type CsvResult = { filename: string; csv: string; rows: number; truncated: boolean };

/**
 * "Export CSV": runs an export action with the filters of the current view and hands the CSV to the
 * browser as a download. Exports are personal data, so the action needs `data.export`, is logged, and is
 * capped (the toast says when the file was cut short). The page decides who sees the button.
 */
export function ExportCsvButton({
  action,
  input,
  label = 'Export CSV',
}: {
  action: 'contacts.exportCsv' | 'activity.exportCsv';
  input: Record<string, unknown>;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const res = await invokeAction(action, input);
      if (!res.ok) return toastActionError(res.error.message, res.error.ref);
      const out = res.data as CsvResult;
      downloadText(out.filename, out.csv);
      toast.success(
        out.truncated
          ? `Downloaded the first ${out.rows.toLocaleString('en-US')} rows. Narrow the filters to get the rest.`
          : `Downloaded ${out.rows.toLocaleString('en-US')} ${out.rows === 1 ? 'row' : 'rows'}.`,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button loading={busy} icon={<DownloadSimpleIcon />} onClick={run}>
      {label}
    </Button>
  );
}
