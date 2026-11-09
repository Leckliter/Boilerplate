'use client';

import { CheckCircleIcon } from '@app/ui/components/icons';
import { Input } from '@app/ui/components/input';
import { Field } from '@app/ui/components/label';
import { useState } from 'react';

import { ActionForm } from '@/components/forms/action-form';

/**
 * Newsletter sign-up for the footer (`newsletter.subscribe`): double opt-in, so this only asks us to send a
 * confirmation email; nobody is subscribed until they click it. The answer is the same whether or not the
 * address was known. `website` is the bot honeypot.
 */
export function NewsletterForm() {
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <p role="status" className="flex items-start gap-2 text-sm">
        <CheckCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
        <span>Almost there: check your email and confirm to join.</span>
      </p>
    );
  }
  return (
    <ActionForm
      action="newsletter.subscribe"
      humanCheck
      keepOpen
      className="grid gap-2"
      onSuccess={() => setDone(true)}
      submitLabel="Subscribe"
      transform={(input) => ({ ...input, source: 'footer' })}
    >
      {(errors) => (
        <>
          <Field label="Email address" hideLabel error={errors.email}>
            <Input
              name="email"
              type="email"
              required
              aria-label="Email address"
              autoComplete="email"
              placeholder="you@example.com"
            />
          </Field>
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <input name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>
        </>
      )}
    </ActionForm>
  );
}
