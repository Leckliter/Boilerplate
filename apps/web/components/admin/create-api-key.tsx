'use client';

import { Callout } from '@app/ui/components/callout';
import { CodeBlock } from '@app/ui/components/code-block';
import { Input, NativeSelect } from '@app/ui/components/input';
import { Field } from '@app/ui/components/label';
import { PlusIcon } from '@app/ui/components/icons';
import { useState } from 'react';

import { ActionForm } from '@/components/forms/action-form';
import { FormDialog } from '@/components/forms/form-dialog';

/**
 * "New API key": the secret is returned ONCE by `apiKeys.create`, so the dialog stays open after saving and
 * shows it with a copy button. Closing the dialog (or the page) loses it by design.
 */
export function CreateApiKey() {
  const [secret, setSecret] = useState<string | null>(null);
  return (
    <FormDialog
      title="New API key"
      description="For scripts and AI assistants (REST API and MCP). The key acts as you."
      trigger="New API key"
      icon={<PlusIcon />}
      triggerVariant="primary"
    >
      {secret ? (
        <div className="grid gap-3">
          <Callout tone="warning">
            Copy the key now. It is shown only once and cannot be recovered.
          </Callout>
          <CodeBlock copy={secret}>{secret}</CodeBlock>
        </div>
      ) : (
        <ActionForm
          action="apiKeys.create"
          submitLabel="Create key"
          keepOpen
          kinds={{ expiresInDays: 'number' }}
          onSuccess={(data) => setSecret((data as { key: string }).key)}
        >
          {(errors) => (
            <>
              <Field label="Name" hint='What it is for, e.g. "Claude desktop".' error={errors.name}>
                <Input name="name" required maxLength={80} autoComplete="off" />
              </Field>
              <Field label="Expires" error={errors.expiresInDays}>
                <NativeSelect name="expiresInDays" defaultValue="90">
                  <option value="30">In 30 days</option>
                  <option value="90">In 90 days</option>
                  <option value="365">In a year</option>
                  <option value="">Never</option>
                </NativeSelect>
              </Field>
            </>
          )}
        </ActionForm>
      )}
    </FormDialog>
  );
}
