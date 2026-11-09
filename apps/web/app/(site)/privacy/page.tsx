import { Prose } from '@app/ui/components/prose';
import type { Metadata } from 'next';

import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy policy',
  alternates: { canonical: '/privacy' },
};

/** Placeholder structure: have a lawyer write the real text before you launch. */
export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Placeholder: not legal advice.</p>
      <Prose className="mt-6">
        <p>
          This policy is a template that matches what {SITE.name} does out of the box. Replace it
          with your own text, and update it when you add services.
        </p>
        <h2>What we collect</h2>
        <p>
          Your name, email and phone if you give them, what you send through the contact form, and
          your choices about notifications. When you sign in we keep a record of the sign-in.
        </p>
        <h2>Cookies and tracking</h2>
        <p>
          Visitors to the public site get no cookies and no analytics. When you sign in, a sign-in
          cookie keeps you signed in; preferences you choose (theme, language, time zone) are stored
          in your browser.
        </p>
        <h2>Email and text messages</h2>
        <p>
          Newsletters need a confirmed subscription and have an unsubscribe link. We only text you
          if you agree to it, and you can reply STOP at any time.
        </p>
        <h2>Your rights</h2>
        <p>
          Signed-in people can download a copy of their data or delete their account from Account →
          Privacy &amp; data. Questions? Use the contact page.
        </p>
      </Prose>
    </div>
  );
}
