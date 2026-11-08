'use client';

import type { ContactView } from '@app/core';
import { DetailItem, DetailList } from '@app/ui/components/detail-list';
import { EditableCard } from '@app/ui/components/editable-card';
import { Input } from '@app/ui/components/input';
import { Field } from '@app/ui/components/label';

import { formDataToInput } from '@/components/forms/action-form';
import { useAction } from '@/lib/use-action';

/** My details: read-only until Edit; saves with `account.update`. The email is the login's, changed through sign-in. */
export function ProfileCard({ me }: { me: ContactView }) {
  const { run } = useAction();
  return (
    <EditableCard
      title="Your details"
      description="Only you and staff can see these."
      onSave={async (form) => (await run('account.update', formDataToInput(form, {}, 'null'), { success: 'Saved' })).ok}
      view={
        <DetailList>
          <DetailItem label="Name">{[me.firstName, me.lastName].filter(Boolean).join(' ')}</DetailItem>
          <DetailItem label="Email" copy={me.email}>
            {me.email}
          </DetailItem>
          <DetailItem label="Phone">{me.phone}</DetailItem>
        </DetailList>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name">
          <Input name="firstName" defaultValue={me.firstName ?? ''} autoComplete="given-name" />
        </Field>
        <Field label="Last name">
          <Input name="lastName" defaultValue={me.lastName ?? ''} autoComplete="family-name" />
        </Field>
      </div>
      <Field label="Phone" hint="Used only if you agree to texts." required={false}>
        <Input name="phone" type="tel" defaultValue={me.phone ?? ''} autoComplete="tel" placeholder="(816) 555-1234" />
      </Field>
    </EditableCard>
  );
}
