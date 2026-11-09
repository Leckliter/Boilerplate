'use client';

import { PlusIcon } from '@app/ui/components/icons';
import { Input, Textarea } from '@app/ui/components/input';
import { Field } from '@app/ui/components/label';

import { ActionForm } from '@/components/forms/action-form';
import { FormDialog } from '@/components/forms/form-dialog';

/** Add or change a setting (`settings.set`). The value is JSON: `"text"`, `42`, `true`, `{"a":1}`. */
export function SettingDialog() {
  return (
    <FormDialog
      title="Add or change a setting"
      description="Settings are plain configuration, never secrets (those go in environment variables)."
      trigger="Add setting"
      icon={<PlusIcon />}
      triggerVariant="primary"
    >
      <ActionForm
        action="settings.set"
        success="Setting saved"
        submitLabel="Save setting"
        kinds={{ value: 'json' }}
      >
        {(errors) => (
          <>
            <Field label="Key" hint="Dotted, e.g. business.name" error={errors.key}>
              <Input name="key" required placeholder="business.name" autoComplete="off" />
            </Field>
            <Field
              label="Value (JSON)"
              hint={'Text needs quotes: "Acme". Numbers, true/false and {…} work too.'}
              error={errors.value}
            >
              <Textarea name="value" rows={3} required className="font-mono" />
            </Field>
          </>
        )}
      </ActionForm>
    </FormDialog>
  );
}
