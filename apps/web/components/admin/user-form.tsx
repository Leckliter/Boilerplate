'use client';

import { Input, Textarea } from '@app/ui/components/input';
import { Field } from '@app/ui/components/label';

/** The editable fields of a user (contact). Shared by "New user" and the record page's Edit card. */
export function UserFields({
  contact,
  errors = {},
}: {
  contact?: { firstName: string | null; lastName: string | null; companyName: string | null; email: string | null; phone: string | null; notes: string | null };
  errors?: Record<string, string | undefined>;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" error={errors.firstName}>
          <Input name="firstName" defaultValue={contact?.firstName ?? ''} autoComplete="off" />
        </Field>
        <Field label="Last name" error={errors.lastName}>
          <Input name="lastName" defaultValue={contact?.lastName ?? ''} autoComplete="off" />
        </Field>
      </div>
      <Field label="Company" required={false} error={errors.companyName}>
        <Input name="companyName" defaultValue={contact?.companyName ?? ''} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" error={errors.email}>
          <Input name="email" type="email" defaultValue={contact?.email ?? ''} />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <Input name="phone" type="tel" defaultValue={contact?.phone ?? ''} placeholder="(816) 555-1234" />
        </Field>
      </div>
      <Field label="Notes" required={false} error={errors.notes}>
        <Textarea name="notes" rows={3} defaultValue={contact?.notes ?? ''} />
      </Field>
    </>
  );
}
