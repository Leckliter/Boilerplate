'use client';

import { Input } from '@app/ui/components/input';
import { Field } from '@app/ui/components/label';

import { ActionForm } from '@/components/forms/action-form';

/** Close this bug (and every repeat of it) with a note on what fixed it. */
export function ResolveForm({ reference }: { reference: string }) {
  return (
    <ActionForm
      action="errors.resolve"
      success="Marked fixed"
      transform={(input) => ({ ...input, ref: reference })}
      submitLabel="Mark fixed"
      submitVariant="secondary"
    >
      {(errors) => (
        <Field label="What fixed it?" hint="A commit, PR link or short note." error={errors.resolution}>
          <Input name="resolution" minLength={3} required />
        </Field>
      )}
    </ActionForm>
  );
}
