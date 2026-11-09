import { Prose } from '@app/ui/components/prose';
import type { Metadata } from 'next';

import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Terms of service',
  alternates: { canonical: '/terms' },
};

/** Placeholder structure: have a lawyer write the real text before you launch. */
export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Terms of service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Placeholder: not legal advice.</p>
      <Prose className="mt-6">
        <p>
          These terms are a template. Replace them with your own text before you launch {SITE.name}.
        </p>
        <h2>Using the service</h2>
        <p>
          Describe who may use the service, what is not allowed, and what happens to accounts that
          break the rules.
        </p>
        <h2>Your content</h2>
        <p>Say who owns what people upload, and what licence you need to run the service.</p>
        <h2>Payments and cancellation</h2>
        <p>Explain prices, billing, refunds and how to cancel.</p>
        <h2>Liability</h2>
        <p>State the limits of your responsibility, as your lawyer advises.</p>
        <h2>Changes and contact</h2>
        <p>Say how you will announce changes to these terms, and where to send questions.</p>
      </Prose>
    </div>
  );
}
