'use client';

import { ListToolbar } from '@app/ui/components/list-toolbar';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState } from 'react';

/**
 * A ListToolbar whose search box lives in the URL (`?q=`), so a filtered list can be linked, bookmarked and
 * reloaded, and the server renders the matching rows. Typing is debounced; paging resets. Other query
 * parameters (filters) are kept.
 */
export function UrlSearch({
  placeholder = 'Search',
  label = 'Search',
  filters,
  actions,
}: {
  placeholder?: string;
  label?: string;
  filters?: ReactNode;
  actions?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get('q') ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function change(next: string) {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const query = new URLSearchParams(params.toString());
      query.delete('page');
      query.delete('before');
      if (next.trim()) query.set('q', next.trim());
      else query.delete('q');
      const qs = query.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
  }

  return (
    <ListToolbar
      search={value}
      onSearchChange={change}
      searchPlaceholder={placeholder}
      searchLabel={label}
      filters={filters}
      actions={actions}
    />
  );
}
