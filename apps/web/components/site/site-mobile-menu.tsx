'use client';

import { Button } from '@app/ui/components/button';
import { ListIcon } from '@app/ui/components/icons';
import { useState } from 'react';
import Link from 'next/link';

import { BottomSheet } from '@/components/layout/bottom-sheet';

/** The links, in a sheet, below the `md` breakpoint. */
export function SiteMobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        shape="square"
        aria-label="Menu"
        className="md:hidden"
        onClick={() => setOpen(true)}
      >
        <ListIcon />
      </Button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Menu"
        onClick={(e) => (e.target as HTMLElement).closest('a') && setOpen(false)}
      >
        <nav className="grid gap-1" aria-label="Menu">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2.5 text-base hover:bg-tint"
            >
              {l.label}
            </Link>
          ))}
          <Link href="/login" className="rounded-lg px-3 py-2.5 text-base hover:bg-tint">
            Sign in
          </Link>
        </nav>
      </BottomSheet>
    </>
  );
}
