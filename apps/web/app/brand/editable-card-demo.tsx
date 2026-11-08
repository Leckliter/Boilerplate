'use client';

import { DetailItem, DetailLink, DetailList } from '@app/ui/components/detail-list';
import { EditableCard } from '@app/ui/components/editable-card';
import { Input } from '@app/ui/components/input';
import { Field } from '@app/ui/components/label';
import { toast } from '@app/ui/components/toaster';
import { useState } from 'react';

/** EditableCard + DetailList on /brand. Saves into local state (no action). */
export function EditableCardDemo() {
  const [info, setInfo] = useState({ name: 'Avery Stone', email: 'avery@example.com', phone: '' });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <EditableCard
        title="Contact info"
        onSave={async (form) => {
          setInfo({
            name: String(form.get('name') ?? '').trim(),
            email: String(form.get('email') ?? '').trim(),
            phone: String(form.get('phone') ?? '').trim(),
          });
          toast.success('Saved');
          return true;
        }}
        view={
          <DetailList>
            <DetailItem label="Name">{info.name}</DetailItem>
            <DetailItem label="Email" copy={info.email}>
              {info.email && <DetailLink href={`mailto:${info.email}`}>{info.email}</DetailLink>}
            </DetailItem>
            <DetailItem label="Phone">{info.phone}</DetailItem>
          </DetailList>
        }
      >
        <Field label="Name" htmlFor="ec-name">
          <Input id="ec-name" name="name" defaultValue={info.name} />
        </Field>
        <Field label="Email" htmlFor="ec-email">
          <Input id="ec-email" name="email" type="email" defaultValue={info.email} />
        </Field>
        <Field label="Phone" htmlFor="ec-phone">
          <Input id="ec-phone" name="phone" type="tel" defaultValue={info.phone} />
        </Field>
      </EditableCard>
      <EditableCard
        title="Read-only"
        description="No Edit button when the viewer can't change it."
        canEdit={false}
        onSave={async () => false}
        view={
          <DetailList>
            <DetailItem label="Unit #">
              <span className="font-mono">10234</span>
            </DetailItem>
            <DetailItem label="Serial number" copy="WTW5000DW1">
              WTW5000DW1
            </DetailItem>
            <DetailItem label="Notes" />
          </DetailList>
        }
      >
        {null}
      </EditableCard>
    </div>
  );
}
