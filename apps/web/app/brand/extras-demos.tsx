'use client';

import { Button } from '@app/ui/components/button';
import { Callout } from '@app/ui/components/callout';
import { Card } from '@app/ui/components/card';
import { FilterTabCount, FilterTabs, filterTabVariants } from '@app/ui/components/filter-tabs';
import { PlusIcon } from '@app/ui/components/icons';
import { ListToolbar } from '@app/ui/components/list-toolbar';
import { PageLoading } from '@app/ui/components/page-skeleton';
import { SkipLink } from '@app/ui/components/skip-link';
import { LinkProvider, LocaleProvider, PortalProvider } from '@app/ui/components/ui-context';
import { toast } from '@app/ui/components/toaster';
import { useState } from 'react';

import { ActionForm } from '@/components/forms/action-form';
import { FormDialog } from '@/components/forms/form-dialog';

/** Page-level building blocks and the wiring components: toolbar, loading states, skip link, providers, forms. */
export function ExtrasDemos() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h3 className="text-sm font-semibold">ListToolbar + FilterTabs</h3>
        <ListToolbar
          search={q}
          onSearchChange={setQ}
          searchPlaceholder="Search projects"
          filters={
            <FilterTabs label="Status">
              {['all', 'open', 'done'].map((f) => (
                <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={filterTabVariants({ active: filter === f })}>
                  {f[0]!.toUpperCase() + f.slice(1)} <FilterTabCount>{f === 'all' ? 12 : f === 'open' ? 5 : 7}</FilterTabCount>
                </button>
              ))}
            </FilterTabs>
          }
          actions={<Button variant="primary" icon={<PlusIcon />}>New project</Button>}
        />
        <p className="text-xs text-muted-foreground">In the app the search box lives in the URL: see UrlSearch in components/admin.</p>
      </div>

      <div className="grid gap-2">
        <h3 className="text-sm font-semibold">PageLoading</h3>
        <p className="text-xs text-muted-foreground">Used by every `loading.tsx`: the real page&rsquo;s shape, announced politely to screen readers.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <PageLoading variant="list" rows={3} />
          </Card>
          <Card className="p-4">
            <PageLoading variant="record" rows={1} />
          </Card>
        </div>
      </div>

      <div className="grid gap-2">
        <h3 className="text-sm font-semibold">SkipLink</h3>
        <p className="text-sm text-muted-foreground">
          Invisible until it takes keyboard focus (press Tab at the top of any page). It jumps to <code className="font-mono text-xs">#main-content</code>.
        </p>
        <div className="relative h-14 overflow-hidden rounded-lg border border-border bg-card">
          <SkipLink href="#brand-skip-target" className="focus:absolute!">Skip to content</SkipLink>
          <p id="brand-skip-target" className="p-4 text-sm text-muted-foreground">
            Focus the link above with Tab to see it.
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        <h3 className="text-sm font-semibold">ActionForm + FormDialog</h3>
        <p className="text-sm text-muted-foreground">
          A new screen is one action plus one form. Fields show their own errors; a bug shows its <code className="font-mono text-xs">E-…</code> reference with a copy button. This demo calls an action that does not exist, so it fails the way a bug would.
        </p>
        <div>
          <FormDialog title="Demo form" trigger="Open a form dialog" icon={<PlusIcon />}>
            <ActionForm action="demo.doesNotExist" submitLabel="Save" success="Saved">
              <p className="text-sm text-muted-foreground">Press Save to see a failure.</p>
            </ActionForm>
          </FormDialog>
        </div>
      </div>

      <div className="grid gap-2">
        <h3 className="text-sm font-semibold">Providers</h3>
        <p className="text-sm text-muted-foreground">
          <code className="font-mono text-xs">LinkProvider</code> (links use next/link), <code className="font-mono text-xs">PortalProvider</code> (where popups render) and <code className="font-mono text-xs">LocaleProvider</code> (words the components say themselves) are mounted once in components/app-providers.tsx.
        </p>
        <LocaleProvider translations={{ layerDialog: { close: 'Close' } }}>
          <LinkProvider>
            <PortalProvider container={null}>
              <Callout tone="info">Toasts: <button type="button" className="underline underline-offset-4" onClick={() => toast.success('Saved')}>show one</button>.</Callout>
            </PortalProvider>
          </LinkProvider>
        </LocaleProvider>
      </div>
    </div>
  );
}
