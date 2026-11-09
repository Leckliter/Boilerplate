'use client';

import { Button } from '@app/ui/components/button';
import { Callout } from '@app/ui/components/callout';
import { Input } from '@app/ui/components/input';
import { Field } from '@app/ui/components/label';
import { useDates } from '@app/ui/components/ui-context';

import { ActionForm } from '@/components/forms/action-form';
import { useAction } from '@/lib/use-action';

/**
 * Texts only go out with recorded consent. The exact wording shown here is stored with the consent
 * (`notifications.setSmsConsent`). Agreeing again after replying STOP is a fresh opt-in.
 */
export function SmsConsentCard({
  phone,
  consentAt,
  stopped,
  consentText,
}: {
  phone: string | null;
  consentAt: Date | null;
  stopped: boolean;
  consentText: string;
}) {
  const { formatDateTime } = useDates();
  const { run, pending } = useAction();
  if (consentAt) {
    return (
      <div className="grid gap-3">
        <p className="text-sm">
          Texts are <strong>on</strong> for {phone}. You agreed on {formatDateTime(consentAt)}.
        </p>
        <div>
          <Button
            loading={pending}
            onClick={() =>
              run(
                'notifications.setSmsConsent',
                { consent: false },
                { success: 'Texts turned off' },
              )
            }
          >
            Stop texts
          </Button>
        </div>
      </div>
    );
  }
  return (
    <ActionForm
      action="notifications.setSmsConsent"
      success="Texts turned on"
      submitLabel="Agree and turn on texts"
      transform={(input) => ({ ...input, consent: true })}
    >
      {(errors) => (
        <>
          {stopped && (
            <Callout tone="info">
              You replied STOP before. Agreeing again turns texts back on.
            </Callout>
          )}
          <Field label="Mobile number" error={errors.phone}>
            <Input name="phone" type="tel" defaultValue={phone ?? ''} autoComplete="tel" required />
          </Field>
          <p className="text-sm text-muted-foreground">{consentText}</p>
        </>
      )}
    </ActionForm>
  );
}
