'use client';

import { NativeSelect } from '@app/ui/components/input';
import { cn } from '@app/ui/lib/utils';
import { useEffect, useState } from 'react';

import { slug } from './slug';

export type BrandNavGroup = { title: string; sections: string[] };

/**
 * The /brand table of contents: a sticky list beside the page on desktop, a select above it on
 * phones. The current section is highlighted as you scroll.
 */
export function BrandNav({ groups }: { groups: BrandNavGroup[] }) {
  const ids = groups.flatMap((g) => g.sections.map(slug));
  const [active, setActive] = useState(ids[0] ?? '');

  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    const obs = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id);
      },
      { rootMargin: '-72px 0px -65% 0px' },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
    // ids never changes after mount (static list).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
    history.replaceState(null, '', `#${id}`);
    setActive(id);
  };

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 border-b border-hairline bg-background/95 px-4 py-2 backdrop-blur lg:hidden">
        <label htmlFor="brand-toc" className="sr-only">
          Jump to section
        </label>
        <NativeSelect id="brand-toc" size="sm" value={active} onChange={(e) => go(e.target.value)}>
          {groups.map((g) => (
            <optgroup key={g.title} label={g.title}>
              {g.sections.map((s) => (
                <option key={s} value={slug(s)}>
                  {s}
                </option>
              ))}
            </optgroup>
          ))}
        </NativeSelect>
      </div>
      <nav
        aria-label="On this page"
        className="sticky top-6 hidden max-h-[calc(100dvh-3rem)] w-52 shrink-0 self-start overflow-y-auto pr-2 lg:block"
      >
        {groups.map((g) => (
          <div key={g.title} className="mb-4">
            <p className="mb-1 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {g.title}
            </p>
            <ul className="grid gap-0.5">
              {g.sections.map((s) => {
                const id = slug(s);
                return (
                  <li key={s}>
                    <a
                      href={`#${id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        go(id);
                      }}
                      aria-current={active === id ? 'location' : undefined}
                      className={cn(
                        'block rounded-md px-2 py-1 text-sm text-muted-foreground outline-none hover:bg-tint hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
                        active === id && 'bg-tint font-medium text-foreground',
                      )}
                    >
                      {s}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
