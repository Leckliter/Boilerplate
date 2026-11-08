import { LinkButton } from '@app/ui/components/link-button';
import { MagnifyingGlassIcon } from '@app/ui/components/icons';
import Link from 'next/link';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="mx-auto grid max-w-md justify-items-start gap-4 px-4 py-24 text-sm"
    >
      <MagnifyingGlassIcon className="size-6 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">That page doesn’t exist or was moved.</p>
      <LinkButton href="/" variant="primary">
        Go to the home page
      </LinkButton>
    </main>
  );
}
