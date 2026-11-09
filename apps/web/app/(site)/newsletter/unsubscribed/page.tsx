import { EnvelopeIcon } from '@app/ui/components/icons';
import { LinkButton } from '@app/ui/components/link-button';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'You’re unsubscribed', robots: { index: false } };

/** Where the unsubscribe link in a newsletter lands. Receipts and security emails are not affected. */
export default function NewsletterUnsubscribedPage() {
  return (
    <div className="mx-auto grid max-w-md justify-items-start gap-4 px-4 py-24 sm:px-6">
      <EnvelopeIcon className="size-8 text-muted-foreground" />
      <h1 className="text-2xl font-semibold tracking-tight">You’re unsubscribed</h1>
      <p className="text-muted-foreground">
        We won’t send you the newsletter any more. Emails about your account, like receipts and
        security notices, will still arrive. Changed your mind? You can subscribe again from the
        footer of any page.
      </p>
      <LinkButton href="/" variant="primary">
        Back to the home page
      </LinkButton>
    </div>
  );
}
