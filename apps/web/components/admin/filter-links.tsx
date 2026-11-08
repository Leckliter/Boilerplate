import { Tabs } from '@app/ui/components/tabs';
import { cn } from '@app/ui/lib/utils';
import Link from 'next/link';

type FilterLink = {
  href: string;
  label: string;
  active: boolean;
  count?: number;
};

/**
 * The tabs above an admin list or record (All · Paid · Late …) as links, so the choice
 * lives in the URL and a tab's data only loads when it's opened. Kumo's sliding Tabs
 * underneath; a row too wide for a phone scrolls inside itself.
 */
export function FilterLinks({
  label,
  items,
  className,
}: {
  label: string;
  items: FilterLink[];
  className?: string;
}) {
  const active = items.find((t) => t.active)?.href ?? '';
  return (
    <nav aria-label={label} className={cn('min-w-0', className)}>
      <Tabs
        value={active}
        tabs={items.map((t) => ({
          value: t.href,
          label: (
            <>
              {t.label}
              {t.count !== undefined && (
                <span className="ml-1.5 text-xs tabular-nums opacity-70">{t.count}</span>
              )}
            </>
          ),
          render: <Link href={t.href} />,
          nativeButton: false,
        }))}
      />
    </nav>
  );
}
