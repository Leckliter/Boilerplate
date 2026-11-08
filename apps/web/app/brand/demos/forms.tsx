'use client';

import { Autocomplete } from '@app/ui/components/autocomplete';
import { Checkbox, CheckboxField } from '@app/ui/components/checkbox';
import { ClipboardText } from '@app/ui/components/clipboard-text';
import { Combobox } from '@app/ui/components/combobox';
import { CopyButton } from '@app/ui/components/copy-button';
import { DatePicker, type DateRange } from '@app/ui/components/date-picker';
import { EnvelopeIcon, MagnifyingGlassIcon } from '@app/ui/components/icons';
import { InlineCopyText } from '@app/ui/components/inline-copy-text';
import { Input, NativeSelect, Textarea } from '@app/ui/components/input';
import { InputGroup } from '@app/ui/components/input-group';
import { Field } from '@app/ui/components/label';
import { Radio } from '@app/ui/components/radio';
import { RadioCard, RadioCardGroup } from '@app/ui/components/radio-card';
import { Select } from '@app/ui/components/select';
import { SensitiveInput } from '@app/ui/components/sensitive-input';
import { Slider } from '@app/ui/components/slider';
import { Switch } from '@app/ui/components/switch';
import { TagInput } from '@app/ui/components/tag-input';
import { useState } from 'react';

function Block({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-hairline py-10">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mb-5 text-sm text-muted-foreground">{description}</p>}
      {children}
    </section>
  );
}

const CATEGORIES = ['Party & event', 'Tools', 'Yard & garden', 'Cleaning', 'Moving'];
const FRUITS = ['Apple', 'Banana', 'Cherry', 'Dragon fruit', 'Elderberry', 'Fig'];
const SUGGESTIONS = ['1200 Main St, Springfield', '1200 Grand Blvd, Springfield'];

/** Inputs, fields, choices, pickers and copy helpers. */
export default function FormsDemos() {
  const [tags, setTags] = useState(['tent', 'tables']);
  const [address, setAddress] = useState('1200 M');
  const [fruit, setFruit] = useState<unknown>('apple');
  const [on, setOn] = useState(true);
  const [cats, setCats] = useState<string[]>(['Tools']);
  const [day, setDay] = useState<Date | undefined>(new Date());
  const [range, setRange] = useState<DateRange | undefined>();

  return (
    <>
      <Block
        title="Input"
        description="Kumo's input: a quiet ring instead of a border, 1.5px focus ring, red ring on error. Sizes xs, sm, base (default) and lg. Give it label / description / error for a ready-made field."
      >
        <div className="grid max-w-md gap-4">
          <Input size="xs" aria-label="Extra small" placeholder="xs" />
          <Input size="sm" aria-label="Small" placeholder="sm" />
          <Input aria-label="Base" placeholder="base (default)" />
          <Input size="lg" aria-label="Large" placeholder="lg" />
          <Input
            label="Email"
            description="We only use it for receipts."
            placeholder="you@example.com"
          />
          <Input label="Phone" error="Enter a 10-digit number." defaultValue="816-555" />
          <Input aria-label="Disabled" placeholder="Disabled" disabled />
          <Input aria-label="Read only" defaultValue="Read only value" readOnly />
        </div>
      </Block>

      <Block
        title="Field"
        description="Label + control + hint or error, linked for screen readers. required={false} adds “(optional)”; labelTooltip adds an info icon. Works around any control."
      >
        <div className="grid max-w-md gap-4">
          <Field label="Company" required={false} hint="Shown on invoices.">
            <Input />
          </Field>
          <Field label="Delivery notes" labelTooltip="Gate codes, dogs, where to leave it.">
            <Textarea />
          </Field>
          <Field label="Category" error="Pick a category.">
            <NativeSelect defaultValue="">
              <option value="" disabled>
                Choose…
              </option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </Block>

      <Block
        title="Textarea"
        description="Fixed box by default; autoResize grows with the text between minRows and maxRows."
      >
        <div className="grid max-w-md gap-4">
          <Textarea aria-label="Notes" placeholder="Notes" />
          <Textarea
            aria-label="Auto-growing"
            placeholder="Type and watch it grow (max 5 rows)…"
            autoResize
            minRows={2}
            maxRows={5}
          />
          <Textarea label="With an error" error="Too short." defaultValue="Hi" />
        </div>
      </Block>

      <Block
        title="Input group"
        description="Icons, text, an inline suffix and buttons in one box. Size, disabled and error come from the group."
      >
        <div className="grid max-w-md gap-4">
          <InputGroup label="Email">
            <InputGroup.Addon>
              <EnvelopeIcon />
            </InputGroup.Addon>
            <InputGroup.Input type="email" placeholder="you@example.com" />
          </InputGroup>
          <InputGroup aria-label="Subdomain">
            <InputGroup.Input placeholder="my-shop" />
            <InputGroup.Suffix>.rentsomethingkc.com</InputGroup.Suffix>
          </InputGroup>
          <InputGroup aria-label="Search" size="lg">
            <InputGroup.Addon>
              <MagnifyingGlassIcon />
            </InputGroup.Addon>
            <InputGroup.Input placeholder="Search the catalog" />
            <InputGroup.Button variant="secondary">Go</InputGroup.Button>
          </InputGroup>
          <InputGroup
            size="sm"
            error={{ message: 'Already taken.', match: true }}
            label="Small, error"
          >
            <InputGroup.Input defaultValue="my-shop" />
          </InputGroup>
          <InputGroup aria-label="Disabled" disabled>
            <InputGroup.Input defaultValue="Disabled" />
          </InputGroup>
        </div>
      </Block>

      <Block
        title="Sensitive input"
        description="A secret that stays masked until you click it. Hover for Copy; Esc masks it again."
      >
        <div className="grid max-w-md gap-4">
          <SensitiveInput label="API key" defaultValue="sk_live_abc123xyz789" />
          <SensitiveInput label="New secret" placeholder="Paste a secret" />
          <SensitiveInput label="With an error" defaultValue="oops" error="That key was revoked." />
        </div>
      </Block>

      <Block
        title="Checkbox"
        description="Kumo's 16px box that fills with the contrast colour. Still a real checkbox input (forms, defaultChecked, onChange). Indeterminate shows a dash."
      >
        <div className="grid max-w-md gap-3">
          <CheckboxField
            label="Text me updates about this project"
            hint="Confirmations, delivery and return reminders. Reply STOP to opt out."
          />
          <div className="flex flex-wrap items-center gap-4">
            <Checkbox aria-label="On" defaultChecked />
            <Checkbox aria-label="Off" />
            <Checkbox aria-label="Locked" defaultChecked disabled />
            <Checkbox aria-label="Error" variant="error" />
            <Checkbox
              aria-label="Mixed"
              ref={(el) => {
                if (el) el.indeterminate = true;
              }}
            />
          </div>
        </div>
      </Block>

      <Block
        title="Radio"
        description="Base UI radio group with Kumo's three looks: default, card and segmented. Error rings it red."
      >
        <div className="grid max-w-md gap-6">
          <Radio.Group legend="Notify me by" defaultValue="email" description="Pick one.">
            <Radio.Item label="Email" value="email" />
            <Radio.Item label="Text" value="sms" />
            <Radio.Item label="Push" value="push" disabled />
          </Radio.Group>
          <Radio.Group legend="Plan" defaultValue="day" appearance="card">
            <Radio.Item label="By the day" description="Back the next morning" value="day" />
            <Radio.Item label="By the week" description="Seven days, one price" value="week" />
          </Radio.Group>
          <Radio.Group legend="View" defaultValue="month" appearance="segmented">
            <Radio.Item label="Day" value="day" />
            <Radio.Item label="Week" value="week" />
            <Radio.Item label="Month" value="month" />
          </Radio.Group>
          <Radio.Group legend="With an error" error="Choose one." defaultValue="">
            <Radio.Item label="Yes" value="y" variant="error" />
            <Radio.Item label="No" value="n" variant="error" />
          </Radio.Group>
        </div>
      </Block>

      <Block
        title="Radio cards"
        description="RadioCard: real radio inputs drawn as cards, for plain forms (name / value / defaultChecked)."
      >
        <RadioCardGroup legend="Getting it to you" className="max-w-md">
          <RadioCard
            name="how"
            value="pickup"
            label="Pickup"
            hint="Mon–Sat, 8–5"
            detail="Free"
            defaultChecked
          />
          <RadioCard name="how" value="delivery" label="Delivery" detail="$35" />
          <RadioCard name="how" value="locked" label="Not available" disabled />
        </RadioCardGroup>
      </Block>

      <Block
        title="Switch"
        description="On/off toggle. Squircle track in 3 sizes; default is the brand colour, neutral is monochrome."
      >
        <div className="grid max-w-md gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <Switch size="sm" aria-label="Small" defaultChecked />
            <Switch aria-label="Base" checked={on} onCheckedChange={setOn} />
            <Switch size="lg" aria-label="Large" />
            <Switch variant="neutral" aria-label="Neutral" defaultChecked />
            <Switch aria-label="Disabled" disabled />
          </div>
          <Switch label="Email receipts" checked={on} onCheckedChange={setOn} />
          <Switch.Group legend="Notify me about" description="You can change this any time.">
            <Switch.Item label="New projects" defaultChecked />
            <Switch.Item label="Returns" />
          </Switch.Group>
        </div>
      </Block>

      <Block
        title="Select"
        description="A custom menu (Base UI Select). For plain forms and phones, NativeSelect is still the better choice."
      >
        <div className="grid max-w-md gap-4">
          <Select
            label="Fruit"
            placeholder="Pick a fruit"
            value={fruit}
            onValueChange={setFruit}
            items={{
              apple: 'Apple',
              banana: 'Banana',
              cherry: { label: 'Cherry (sold out)', disabled: true },
            }}
          />
          <Select aria-label="Small" size="sm" placeholder="Small" items={{ a: 'One', b: 'Two' }} />
          <Select aria-label="Large" size="lg" placeholder="Large" items={{ a: 'One', b: 'Two' }} />
          <Select label="With an error" error="Pick one." placeholder="Pick" items={{ a: 'One' }} />
          <Select aria-label="Loading" loading items={{ a: 'One' }} />
        </div>
      </Block>

      <Block
        title="Combobox"
        description="A type-to-filter picker. Single select with the input in the trigger, or multi-select with chips."
      >
        <div className="grid max-w-md gap-4">
          <Combobox label="Fruit" items={FRUITS}>
            <Combobox.TriggerInput placeholder="Search fruit" />
            <Combobox.Content>
              <Combobox.Empty />
              <Combobox.List>
                {(item: string) => (
                  <Combobox.Item key={item} value={item}>
                    {item}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Content>
          </Combobox>
          <Combobox
            label="Categories"
            items={CATEGORIES}
            multiple
            value={cats}
            onValueChange={setCats}
          >
            <Combobox.TriggerMultipleWithInput
              placeholder="Pick some"
              value={cats}
              renderItem={(v: string) => <Combobox.Chip key={v}>{v}</Combobox.Chip>}
            />
            <Combobox.Content>
              <Combobox.Empty />
              <Combobox.List>
                {(item: string) => (
                  <Combobox.Item key={item} value={item}>
                    {item}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Content>
          </Combobox>
        </div>
      </Block>

      <Block
        title="Autocomplete & tags"
        description="Autocomplete: a text box with suggestions you load (Google addresses). TagInput: free-text tags in one box; Enter or comma adds one."
      >
        <div className="grid max-w-md gap-4">
          <Field label="Street address">
            <Autocomplete
              value={address}
              onValueChange={setAddress}
              items={address.length > 2 ? SUGGESTIONS : []}
              itemToString={(s: string) => s}
              onSelect={(s: string) => setAddress(s)}
              footer="Suggestions by Google Maps"
            />
          </Field>
          <Field label="Tags" hint="Press Enter to add.">
            <TagInput value={tags} onChange={setTags} suggestions={['party', 'tent', 'tables']} />
          </Field>
        </div>
      </Block>

      <Block
        title="Slider"
        description="Single value or a range (pass an array). Value pills show under the thumbs."
      >
        <div className="grid max-w-md gap-8 pb-8">
          <Slider label="Days" defaultValue={3} min={1} max={14} />
          <Slider label="Price range" defaultValue={[20, 80]} size="sm" />
          <Slider label="Disabled" defaultValue={40} disabled />
        </div>
      </Block>

      <Block
        title="Date picker"
        description="Kumo's date picker on react-day-picker (single, multiple or range). The date range picker is two months side by side; they wrap on phones. The week/month views of the calendar are the Calendar section."
      >
        <div className="flex flex-wrap items-start gap-6">
          <div className="rounded-xl ring ring-border">
            <DatePicker mode="single" selected={day} onChange={setDay} className="p-3" />
          </div>
          <div className="rounded-xl ring ring-border">
            <DatePicker
              mode="range"
              selected={range}
              onChange={setRange}
              numberOfMonths={1}
              className="p-3"
            />
          </div>
        </div>
      </Block>

      <Block
        title="Copying"
        description="ClipboardText (a value with a copy button; masked hides it behind an eye), InlineCopyText (click text to copy) and CopyButton."
      >
        <div className="grid max-w-md gap-4">
          <ClipboardText text="npm i @app/ui" />
          <ClipboardText size="sm" text="sk_live_51Mx0aQ2eZvKYlo2C" masked />
          <ClipboardText
            size="base"
            text="With a tooltip"
            tooltip={{ text: 'Copy', copiedText: 'Copied' }}
          />
          <p className="text-sm">
            Project <InlineCopyText>prj_1Nx8Kq</InlineCopyText>
          </p>
          <p className="text-sm">
            Call{' '}
            <InlineCopyText variant="body" value="+18165550100">
              (816) 555-0100
            </InlineCopyText>
          </p>
          <div className="flex flex-wrap gap-2">
            <CopyButton value="E-7K3QX9MD">Copy reference</CopyButton>
          </div>
        </div>
      </Block>
    </>
  );
}
