import { docTree } from '@app/core/docs';
import { Input } from '@app/ui/components/input';

import { DocsNav } from '@/components/docs/docs-nav';
import { getActor } from '@/lib/viewer';

export const metadata = { title: { default: 'Docs', template: '%s · Docs' } };

/** The docs: a section list beside the page, and a search box. Internal docs only appear for staff. */
export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const tree = docTree(await getActor());
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 md:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="grid content-start gap-5">
        <form action="/docs" role="search">
          <Input
            type="search"
            name="q"
            placeholder="Search the docs"
            aria-label="Search the docs"
          />
        </form>
        <DocsNav tree={tree} />
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
