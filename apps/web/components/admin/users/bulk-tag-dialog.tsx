'use client';

import { CheckboxField } from '@app/ui/components/checkbox';
import { TagIcon } from '@app/ui/components/icons';

import { ActionForm } from '@/components/forms/action-form';
import { FormDialog } from '@/components/forms/form-dialog';

/** "Add tags" for the selected users: `contacts.bulkAddTags` (all or nothing, one activity entry). */
export function BulkTagDialog({
  ids,
  tags,
}: {
  ids: string[];
  tags: { slug: string; label: string }[];
}) {
  return (
    <FormDialog
      title={`Add tags to ${ids.length} ${ids.length === 1 ? 'user' : 'users'}`}
      description="People who already have a tag keep it. Tags describe people; they never grant access."
      trigger="Add tags"
      icon={<TagIcon />}
      triggerSize="sm"
    >
      <ActionForm
        action="contacts.bulkAddTags"
        success="Tags added"
        submitLabel="Add tags"
        transform={(input) => ({ ids, tags: input.tags ?? [] })}
      >
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-base font-medium">Tags</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {tags.map((t) => (
              <CheckboxField key={t.slug} name="tags[]" value={t.slug} label={t.label} />
            ))}
          </div>
        </fieldset>
      </ActionForm>
    </FormDialog>
  );
}
