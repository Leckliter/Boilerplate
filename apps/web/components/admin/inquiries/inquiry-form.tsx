'use client';

import { confirm } from '@app/ui/components/alert-dialog';
import { Button } from '@app/ui/components/button';
import { ArchiveIcon } from '@app/ui/components/icons';
import { NativeSelect, Textarea } from '@app/ui/components/input';
import { Field } from '@app/ui/components/label';
import { useRouter } from 'next/navigation';

import { ActionForm } from '@/components/forms/action-form';
import { useAction } from '@/lib/use-action';

const STATUSES = [
  ['new', 'New'],
  ['in_progress', 'In progress'],
  ['resolved', 'Resolved'],
  ['spam', 'Spam'],
] as const;

/** Work on one inquiry: change its status and the internal note (`inquiries.update`), or archive it. */
export function InquiryForm({
  id,
  status,
  note,
}: {
  id: string;
  status: string;
  note: string | null;
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  return (
    <div className="grid gap-4">
      <ActionForm
        action="inquiries.update"
        success="Saved"
        submitLabel="Save"
        keepOpen
        blank="null"
        transform={(input) => ({ id, status: input.status, note: input.note ?? null })}
      >
        {(errors) => (
          <>
            <Field label="Status" error={errors.status}>
              <NativeSelect name="status" defaultValue={status}>
                {STATUSES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
                {status === 'archived' && <option value="archived">Archived</option>}
              </NativeSelect>
            </Field>
            <Field
              label="Internal note"
              hint="Only staff see this, never the sender."
              required={false}
              error={errors.note}
            >
              <Textarea name="note" rows={4} defaultValue={note ?? ''} maxLength={5000} />
            </Field>
          </>
        )}
      </ActionForm>
      {status !== 'archived' && (
        <div className="border-t border-hairline pt-4">
          <Button
            variant="destructive"
            icon={<ArchiveIcon />}
            loading={pending}
            onClick={async () => {
              const ok = await confirm({
                title: 'Archive this inquiry?',
                description:
                  'It leaves the open list. Nothing is deleted; set a status to bring it back.',
                confirmLabel: 'Archive',
              });
              if (!ok) return;
              const res = await run(
                'inquiries.archive',
                { id },
                { success: 'Archived', refresh: false },
              );
              if (res.ok) router.push('/admin/inquiries');
            }}
          >
            Archive
          </Button>
        </div>
      )}
    </div>
  );
}
