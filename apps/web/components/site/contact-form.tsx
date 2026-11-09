'use client';

import { Callout } from '@app/ui/components/callout';
import { CheckCircleIcon } from '@app/ui/components/icons';
import { Input, Textarea } from '@app/ui/components/input';
import { Field } from '@app/ui/components/label';
import { useState } from 'react';

import { ActionForm } from '@/components/forms/action-form';

/**
 * The website contact form (`inquiries.create`, a public action: rate-limited, bot-checked, with a honeypot).
 * `website` is the honeypot: invisible and unreachable to people, filled in by bots, silently dropped by the
 * action. On success the form is replaced by a thank-you; a rate-limit refusal shows the action's own
 * message ("try again later") under the form.
 */
export function ContactForm() {
  const [sent, setSent] = useState(false);
  if (sent) {
    return (
      <Callout tone="success" className="flex items-start gap-3">
        <CheckCircleIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
        <span role="status">
          <strong className="block font-semibold">Thanks, we got your message.</strong>
          We read everything and will reply to the email you gave us.
        </span>
      </Callout>
    );
  }
  return (
    <ActionForm
      action="inquiries.create"
      humanCheck
      keepOpen
      onSuccess={() => setSent(true)}
      submitLabel="Send message"
      transform={(input) => ({ ...input, source: 'contact' })}
    >
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" error={errors.name}>
              <Input name="name" required autoComplete="name" maxLength={120} />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input name="email" type="email" required autoComplete="email" />
            </Field>
          </div>
          <Field label="Subject" required={false} error={errors.subject}>
            <Input name="subject" maxLength={200} />
          </Field>
          <Field label="Message" error={errors.message}>
            <Textarea name="message" required rows={6} minLength={5} maxLength={5000} />
          </Field>
          {/* Honeypot: bots fill every field. Hidden from people and from assistive tech, out of the tab order. */}
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Leave this empty
              <input name="website" type="text" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
        </>
      )}
    </ActionForm>
  );
}
