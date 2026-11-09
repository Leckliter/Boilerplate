import { MagnifyingGlassIcon } from '@app/ui/components/icons';
import { LinkButton } from '@app/ui/components/link-button';

export const metadata = { title: 'Page not found' };

/** A missing public page, inside the site's header and footer (the root not-found covers the rest). */
export default function SiteNotFound() {
  return (
    <div className="mx-auto grid max-w-md justify-items-start gap-4 px-4 py-24 text-sm sm:px-6">
      <MagnifyingGlassIcon className="size-6 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">That page doesn’t exist or was moved.</p>
      <div className="flex flex-wrap gap-2">
        <LinkButton href="/" variant="primary">
          Go to the home page
        </LinkButton>
        <LinkButton href="/docs">Search the help pages</LinkButton>
      </div>
    </div>
  );
}
