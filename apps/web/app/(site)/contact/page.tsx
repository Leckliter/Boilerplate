import { Card } from '@app/ui/components/card';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ContactForm } from '@/components/site/contact-form';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact',
  description: `Send ${SITE.name} a message. We read everything and reply by email.`,
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-16 sm:px-6">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Contact us</h1>
        <p className="text-muted-foreground">
          Questions, feedback or a project in mind? Send a message and we’ll reply by email. If
          you’d rather read first, the{' '}
          <Link href="/docs" className="underline underline-offset-4">
            help pages
          </Link>{' '}
          may already have the answer.
        </p>
      </div>
      <Card className="p-6">
        <ContactForm />
      </Card>
    </div>
  );
}
