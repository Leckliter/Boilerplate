'use client';

import { CheckboxField } from '@app/ui/components/checkbox';
import { PlusIcon } from '@app/ui/components/icons';

import { ActionForm } from '@/components/forms/action-form';
import { FormDialog } from '@/components/forms/form-dialog';

import { UserFields } from './user-form';

/** "New user" in the Users page's actions: a dialog around `contacts.create`. */
export function NewUserDialog({ tags }: { tags: { slug: string; label: string }[] }) {
  return (
    <FormDialog
      title="New user"
      description="Anyone the business deals with: a customer, a lead, staff, a vendor."
      trigger="New user"
      icon={<PlusIcon />}
      triggerVariant="primary"
    >
      <ActionForm action="contacts.create" success="User created" submitLabel="Create user">
        {(errors) => (
          <>
            <UserFields errors={errors} />
            {tags.length > 0 && (
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-base font-medium">What are they?</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {tags.map((t) => (
                    <CheckboxField key={t.slug} name="tags[]" value={t.slug} label={t.label} />
                  ))}
                </div>
              </fieldset>
            )}
          </>
        )}
      </ActionForm>
    </FormDialog>
  );
}
