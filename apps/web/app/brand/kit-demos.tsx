'use client';

import { Autocomplete } from '@app/ui/components/autocomplete';
import { Button } from '@app/ui/components/button';
import { CountBadge } from '@app/ui/components/badge';
import { CodeBlock } from '@app/ui/components/code-block';
import { Dialog, DialogTrigger, SheetContent } from '@app/ui/components/dialog';
import { FilterTabCount, FilterTabs, filterTabVariants } from '@app/ui/components/filter-tabs';
import { linkVariants } from '@app/ui/components/link';
import { Field } from '@app/ui/components/label';
import { RadioCard, RadioCardGroup } from '@app/ui/components/radio-card';
import { TagInput } from '@app/ui/components/tag-input';
import { formatMoney } from '@app/ui/lib/money';

import { BellIcon } from '@app/ui/components/icons';
import { useState } from 'react';

/** /brand demos for the smaller building blocks (client-side for the interactive ones). */
export function KitDemos() {
  const [active, setActive] = useState('all');
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState(['customers', 'follow-up']);
  const [street, setStreet] = useState('');
  const streets = ['1 Main St', '100 Grand Blvd', '1200 Walnut St', '4500 Oak St'];
  const found = street.length > 0 ? streets.filter((s) => s.includes(street)) : [];
  return (
    <div className="grid gap-8">
      <Field
        label="TagInput — free-text tags"
        hint="Enter or comma adds one, Backspace removes the last. Suggestions show as you type."
        className="max-w-md"
      >
        <TagInput value={tags} onChange={setTags} suggestions={['checkout', 'leads', 'texts']} />
      </Field>
      <Field
        label="Autocomplete — suggestions you load yourself"
        hint="Address fields use it with Google's suggestions. Try typing 1 or St."
        className="max-w-md"
      >
        <Autocomplete
          value={street}
          onValueChange={setStreet}
          items={found}
          itemToString={(s) => s}
          onSelect={setStreet}
          footer="Suggestions from a demo list"
        />
      </Field>
      <div className="grid gap-2">
        <p className="text-sm font-medium">FilterTabs — filters above a list (links in real use)</p>
        <FilterTabs label="Status">
          {[
            ['all', 'All', 24],
            ['paid', 'To deliver', 3],
            ['out', 'Out', 12],
            ['late', 'Late', 1],
          ].map(([key, label, n]) => (
            <a
              key={key}
              href={`#${key}`}
              onClick={(e) => (e.preventDefault(), setActive(String(key)))}
              aria-current={active === key ? 'page' : undefined}
              className={filterTabVariants({ active: active === key })}
            >
              {label} <FilterTabCount>{n}</FilterTabCount>
            </a>
          ))}
        </FilterTabs>
      </div>

      <div className="grid max-w-md gap-2">
        <RadioCardGroup legend="RadioCard — pick one option">
          <RadioCard name="demo-how" value="pickup" label="Pickup" detail="Free" defaultChecked />
          <RadioCard
            name="demo-how"
            value="delivery"
            label="Delivery"
            hint="We bring it to your door"
            detail={formatMoney(4900)}
          />
          <RadioCard
            name="demo-how"
            value="install"
            label="Delivery + installation"
            detail="$79.00"
            disabled
          />
        </RadioCardGroup>
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium">Links, loading button, count badge, side sheet</p>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <a href="#links" className={linkVariants()}>
            Primary link
          </a>
          <a href="#links" className={linkVariants({ tone: 'inherit' })}>
            Inherit link
          </a>
          <a href="#links" className={linkVariants({ tone: 'muted' })}>
            ← Muted link
          </a>
          <Button
            loading={saving}
            onClick={() => {
              setSaving(true);
              setTimeout(() => setSaving(false), 1500);
            }}
          >
            {saving ? 'Saving…' : 'Save (loading)'}
          </Button>
          <span className="relative inline-flex" role="img" aria-label="Notifications, 3 unread">
            <BellIcon className="size-5" />
            <CountBadge count={3} className="absolute -top-1.5 -right-2" />
          </span>
          <Dialog>
            <DialogTrigger render={<Button variant="outline" />}>Open sheet</DialogTrigger>
            <SheetContent title="Filters" side="right">
              <p className="p-2 text-sm">A side sheet: phone menus, filters, a quick look.</p>
            </SheetContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium">CodeBlock — JSON, stack traces, URLs to paste</p>
        <CodeBlock copy="https://example.com/api/mcp">https://example.com/api/mcp</CodeBlock>
      </div>
    </div>
  );
}
