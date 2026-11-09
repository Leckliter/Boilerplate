import { LinkButton } from '@app/ui/components/link-button';
import { Prose } from '@app/ui/components/prose';
import type { Metadata } from 'next';

import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About',
  description: `Who is behind ${SITE.name} and how it is built.`,
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">About {SITE.name}</h1>
      <Prose className="mt-6">
        <p>{SITE.description}</p>
        <p>
          This page is a placeholder. Tell visitors who you are, what you do, and how to reach you.
        </p>
        <h2>How it is built</h2>
        <p>
          One Next.js app serves the public site, the customer portal and the admin. All business
          logic lives in actions that the web app, the REST API and AI assistants share.
        </p>
        <h2>What we do with your data</h2>
        <p>
          Only what is needed to run your account. The public site sets no cookies and has no
          analytics. Read the privacy policy for the details.
        </p>
      </Prose>
      <div className="mt-8 flex flex-wrap gap-3">
        <LinkButton href="/contact" variant="primary">
          Get in touch
        </LinkButton>
        <LinkButton href="/privacy">Privacy policy</LinkButton>
      </div>
    </div>
  );
}
