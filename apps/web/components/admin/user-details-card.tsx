'use client';

import type { ContactView } from '@app/core';
import { DetailItem, DetailLink, DetailList } from '@app/ui/components/detail-list';
import { EditableCard } from '@app/ui/components/editable-card';

import { formDataToInput } from '@/components/forms/action-form';
import { useAction } from '@/lib/use-action';

import { UserFields } from './user-form';

/** A user's details: shown read-only, with Edit for people who may change them (contacts.update). */
export function UserDetailsCard({
  contact: c,
  canEdit,
}: {
  contact: ContactView;
  canEdit: boolean;
}) {
  const { run } = useAction();
  return (
    <EditableCard
      title="Details"
      canEdit={canEdit}
      onSave={async (form) =>
        (
          await run(
            'contacts.update',
            { id: c.id, ...formDataToInput(form, {}, 'null') },
            { success: 'Saved' },
          )
        ).ok
      }
      view={
        <DetailList>
          <DetailItem label="Name">
            {[c.firstName, c.lastName].filter(Boolean).join(' ')}
          </DetailItem>
          <DetailItem label="Company">{c.companyName}</DetailItem>
          <DetailItem label="Email" copy={c.email}>
            {c.email && <DetailLink href={`mailto:${c.email}`}>{c.email}</DetailLink>}
          </DetailItem>
          <DetailItem label="Phone" copy={c.phone}>
            {c.phone && <DetailLink href={`tel:${c.phone}`}>{c.phone}</DetailLink>}
          </DetailItem>
          <DetailItem label="Notes">{c.notes}</DetailItem>
        </DetailList>
      }
    >
      <UserFields contact={c} />
    </EditableCard>
  );
}
