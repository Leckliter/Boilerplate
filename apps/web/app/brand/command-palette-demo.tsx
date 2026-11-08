'use client';

import {
  type CommandItem,
  CommandPalette,
  CommandPaletteTrigger,
  filterCommands,
} from '@app/ui/components/command-palette';
import { toast } from '@app/ui/components/toaster';
import { PackageIcon, ReceiptIcon, UserPlusIcon, UsersIcon } from '@app/ui/components/icons';
import { useState } from 'react';

const PAGES: CommandItem[] = [
  { id: 'contacts', label: 'Contacts', icon: <UsersIcon />, hint: 'Page', keywords: ['people'] },
  { id: 'orders', label: 'Orders', icon: <ReceiptIcon />, hint: 'Page' },
  { id: 'catalog', label: 'Catalog', icon: <PackageIcon />, hint: 'Page', keywords: ['products'] },
];
const ACTIONS: CommandItem[] = [
  { id: 'new-contact', label: 'New contact', icon: <UserPlusIcon />, keywords: ['add'] },
];

/** CommandPalette on /brand, with a fixed list (Admin adds live search results). */
export function CommandPaletteDemo() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  return (
    <div className="max-w-60">
      <CommandPaletteTrigger onClick={() => setOpen(true)} />
      <CommandPalette
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQuery('');
        }}
        query={query}
        onQueryChange={setQuery}
        groups={[
          { label: 'Actions', items: filterCommands(ACTIONS, query) },
          { label: 'Pages', items: filterCommands(PAGES, query) },
        ]}
        onSelect={(item) => {
          setOpen(false);
          setQuery('');
          toast.success(`Picked “${item.label}”`);
        }}
      />
    </div>
  );
}
