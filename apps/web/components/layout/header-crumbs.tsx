'use client';

import { Breadcrumbs } from '@app/ui/components/breadcrumbs';
import { usePathname } from 'next/navigation';

import { activeItem, type AppDef, type NavGroup } from '@/lib/nav';

const ID_LIKE = /^([0-9a-f]{8}-[0-9a-f-]{27}|[0-9a-f]{24,}|\d+)$/i;

const title = (segment: string) =>
  segment.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

/**
 * The trail in the header, built from the URL and the nav: App › Section › Record. Ids show as "Details"
 * (an `E-…` error reference shows as itself). Hidden on the smallest phones, where the page title says it.
 */
export function HeaderCrumbs({ app, groups }: { app: AppDef; groups: NavGroup[] }) {
  const pathname = usePathname();
  const item = activeItem(pathname, groups);
  const rest = pathname.split('/').filter(Boolean).slice(app.href.split('/').filter(Boolean).length);
  const trail: { label: string; href: string }[] = [];
  let href = app.href;
  const itemDepth = item ? item.href.split('/').filter(Boolean).length - app.href.split('/').filter(Boolean).length : 0;
  rest.forEach((segment, i) => {
    href += `/${segment}`;
    if (item && i < itemDepth) {
      if (i === itemDepth - 1) trail.push({ label: item.label, href });
      return;
    }
    const label = ID_LIKE.test(segment) ? 'Details' : /^E-/.test(segment) ? segment : title(decodeURIComponent(segment));
    trail.push({ label, href });
  });
  const here = trail.at(-1);
  return (
    <Breadcrumbs size="sm" className="mr-0 hidden min-w-0 flex-1 sm:flex">
      {rest.length === 0 ? (
        <Breadcrumbs.Current>{item?.label ?? app.label}</Breadcrumbs.Current>
      ) : (
        <>
          <Breadcrumbs.Link href={app.href}>{app.label}</Breadcrumbs.Link>
          {trail.map((c) => (
            <span key={c.href} className="contents">
              <Breadcrumbs.Separator />
              {c === here ? (
                <Breadcrumbs.Current>{c.label}</Breadcrumbs.Current>
              ) : (
                <Breadcrumbs.Link href={c.href}>{c.label}</Breadcrumbs.Link>
              )}
            </span>
          ))}
        </>
      )}
    </Breadcrumbs>
  );
}
