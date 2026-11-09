'use client';

import { Button } from '@app/ui/components/button';
import { CheckboxField } from '@app/ui/components/checkbox';
import { Callout } from '@app/ui/components/callout';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@app/ui/components/dialog';
import { FileDrop } from '@app/ui/components/file-drop';
import { FileCsvIcon } from '@app/ui/components/icons';
import { Textarea } from '@app/ui/components/input';
import { Field } from '@app/ui/components/label';
import { toast } from '@app/ui/components/toaster';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FormError } from '@/components/forms/field-error';
import { invokeAction } from '@/lib/invoke';

type Preview = {
  dryRun: boolean;
  total: number;
  created: number;
  duplicates: number;
  invalid: number;
  problems: { row: number; status: 'duplicate' | 'invalid'; message: string }[];
  problemsTruncated: boolean;
};

const TEMPLATE =
  'first_name,last_name,company,email,phone,notes,tags\nAda,Lovelace,,ada@example.com,,,lead\n';

/**
 * Import contacts from a CSV in two steps, as `contacts.import` is built for: "Check the file" runs it with
 * `dryRun` (nothing is saved; every row that would be skipped is listed with why), then "Import" commits
 * the valid rows. The file is read in the browser and sent as text (up to 2,000 rows).
 */
export function ImportDialog({ tags }: { tags: { slug: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<{ message: string; ref?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCsv('');
    setFileName(null);
    setPicked([]);
    setPreview(null);
    setError(null);
  };

  async function send(dryRun: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await invokeAction('contacts.import', { csv, dryRun, tags: picked });
      if (!res.ok) {
        setPreview(null);
        setError({ message: res.error.message, ref: res.error.ref });
        return;
      }
      const out = res.data as Preview;
      if (dryRun) return setPreview(out);
      toast.success(`Imported ${out.created} ${out.created === 1 ? 'contact' : 'contacts'}.`);
      setOpen(false);
      reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button icon={<FileCsvIcon />}>Import CSV</Button>} />
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Import users from a CSV</DialogTitle>
          <DialogDescription>
            Columns: first_name, last_name, company, email, phone, notes, tags
            (semicolon-separated). Rows whose email already exists are skipped. Nothing is saved
            until you press Import.{' '}
            <a
              className="underline underline-offset-4"
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
              download="users-template.csv"
            >
              Download a template
            </a>
            .
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FileDrop
            multiple={false}
            accept=".csv,text/csv"
            label={fileName ?? 'Drop a CSV here or click to choose'}
            hint="Up to 2,000 rows"
            onFiles={async ([file]) => {
              if (!file) return;
              setCsv(await file.text());
              setFileName(file.name);
              setPreview(null);
              setError(null);
            }}
          />
          <Field label="Or paste CSV text" required={false}>
            <Textarea
              rows={4}
              value={csv}
              className="font-mono text-xs"
              onChange={(e) => {
                setCsv(e.target.value);
                setPreview(null);
              }}
            />
          </Field>
          {tags.length > 0 && (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">Also tag everyone imported as</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {tags.map((t) => (
                  <CheckboxField
                    key={t.slug}
                    label={t.label}
                    checked={picked.includes(t.slug)}
                    onChange={(e) =>
                      setPicked((p) =>
                        e.target.checked ? [...p, t.slug] : p.filter((s) => s !== t.slug),
                      )
                    }
                  />
                ))}
              </div>
            </fieldset>
          )}
          {error && <FormError message={error.message} reference={error.ref} />}
          {preview && <PreviewReport preview={preview} />}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              onClick={() => send(true)}
              disabled={!csv.trim() || busy}
              loading={busy && !preview}
            >
              Check the file
            </Button>
            <Button
              variant="primary"
              onClick={() => send(false)}
              disabled={!preview || preview.created === 0 || busy}
              loading={busy && Boolean(preview)}
            >
              {preview
                ? `Import ${preview.created} ${preview.created === 1 ? 'user' : 'users'}`
                : 'Import'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewReport({ preview }: { preview: Preview }) {
  const clean = preview.problems.length === 0;
  return (
    <div className="grid gap-3" aria-live="polite">
      <Callout tone={clean ? 'success' : preview.created === 0 ? 'danger' : 'warning'}>
        {preview.total} {preview.total === 1 ? 'row' : 'rows'} in the file: {preview.created} will
        be imported
        {preview.duplicates > 0 && `, ${preview.duplicates} duplicates skipped`}
        {preview.invalid > 0 && `, ${preview.invalid} invalid skipped`}.
      </Callout>
      {!clean && (
        <div className="max-h-56 overflow-y-auto rounded-lg ring ring-border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Rows that will be skipped</caption>
            <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Row
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Problem
                </th>
              </tr>
            </thead>
            <tbody>
              {preview.problems.map((p) => (
                <tr key={`${p.row}-${p.message}`} className="border-t border-hairline">
                  <td className="px-3 py-1.5 tabular-nums">{p.row}</td>
                  <td className="px-3 py-1.5">
                    <span className="text-muted-foreground">
                      {p.status === 'duplicate' ? 'Duplicate: ' : 'Invalid: '}
                    </span>
                    {p.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.problemsTruncated && (
            <p className="border-t border-hairline px-3 py-2 text-xs text-muted-foreground">
              Only the first problems are listed.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
