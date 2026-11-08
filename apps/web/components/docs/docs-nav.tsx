import type { Doc, DocSection } from '@app/core/docs';
import { Badge } from '@app/ui/components/badge';
import { cn } from '@app/ui/lib/utils';
import Link from 'next/link';

/** The sections and pages the reader may see. The current page is marked. */
export function DocsNav({
  tree,
  current,
}: {
  tree: (DocSection & { docs: Doc[] })[];
  current?: string;
}) {
  return (
    <nav aria-label="Docs" className="grid gap-5 text-sm">
      {tree.map((s) => (
        <div key={s.id} className="grid gap-1">
          <p className="font-semibold">{s.title}</p>
          <ul className="grid gap-0.5">
            {s.docs.map((d) => (
              <li key={d.slug}>
                <Link
                  href={`/docs/${d.slug}`}
                  aria-current={d.slug === current ? 'page' : undefined}
                  className={cn(
                    'flex min-w-0 flex-wrap items-center gap-2 rounded-md px-2 py-1 hover:bg-accent',
                    d.slug === current && 'bg-accent font-medium',
                  )}
                >
                  <span className="min-w-0 break-words">{d.title}</span>
                  {d.audience === 'internal' && <Badge color="amber">Staff</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
