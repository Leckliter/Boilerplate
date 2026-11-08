'use client';

import { CheckboxField } from '@app/ui/components/checkbox';
import { useRouter } from 'next/navigation';

import { ActionForm } from '@/components/forms/action-form';

import { UserFields } from './user-form';

/** The full-page "New user" form; goes to the new record when it is saved. */
export function NewUserForm({ tags }: { tags: { slug: string; label: string }[] }) {
  const router = useRouter();
  return (
    <ActionForm
      action="contacts.create"
      success="User created"
      submitLabel="Create user"
      onSuccess={(data) => router.push(`/admin/users/${(data as { id: string }).id}`)}
    >
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
  );
}
