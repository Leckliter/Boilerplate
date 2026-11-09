import { CheckCircleIcon } from '@app/ui/components/icons';
import { LinkButton } from '@app/ui/components/link-button';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'You’re subscribed', robots: { index: false } };

/** Where the newsletter confirmation link lands once the subscription is confirmed. */
export default function NewsletterConfirmedPage() {
  return (
    <div className="mx-auto grid max-w-md justify-items-start gap-4 px-4 py-24 sm:px-6">
      <CheckCircleIcon weight="fill" className="size-8 text-success" />
      <h1 className="text-2xl font-semibold tracking-tight">You’re subscribed</h1>
      <p className="text-muted-foreground">
        Thanks for confirming. You’ll get our next newsletter, and every one has an unsubscribe
        link.
      </p>
      <LinkButton href="/" variant="primary">
        Back to the home page
      </LinkButton>
    </div>
  );
}
