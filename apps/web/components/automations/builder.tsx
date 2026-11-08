'use client';

import type { DefinitionInput } from '@app/core/automations';
import { Button } from '@app/ui/components/button';
import { Callout } from '@app/ui/components/callout';
import { Card, CardContent, CardHeader, CardTitle } from '@app/ui/components/card';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from '@app/ui/components/icons';
import { Input, NativeSelect, Textarea } from '@app/ui/components/input';
import { Field } from '@app/ui/components/label';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useAction } from '@/lib/use-action';

/**
 * A simple visual builder: trigger → only if → steps. It edits the same JSON as the API (the JSON tab
 * shows it, and is the way to write if/else branches, cancel rules and other advanced shapes). Text
 * fields accept templates such as `{{event.data.contactId}}`: see Admin → Automations → reference
 * (`automations.reference`) for every value available.
 */
type Option = { value: string; label: string };
type Row = Record<string, unknown> & { type: string };
type Cond = { path: string; op: string; value: string };

const STEP_TYPES: Option[] = [
  { value: 'action', label: 'Run an action' },
  { value: 'wait', label: 'Wait' },
  { value: 'waitForEvent', label: 'Wait for an event' },
  { value: 'condition', label: 'Stop unless…' },
  { value: 'notifyStaff', label: 'Tell staff' },
  { value: 'notifyContact', label: 'Message a contact' },
  { value: 'sendEmail', label: 'Email a contact' },
  { value: 'sendText', label: 'Text a contact' },
  { value: 'webhook', label: 'Call a webhook' },
];
const OPS = [
  'equals',
  'notEquals',
  'in',
  'notIn',
  'exists',
  'notExists',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
];

const blank = (type: string): Row => {
  switch (type) {
    case 'action':
      return { type, action: '', input: {} };
    case 'wait':
      return { type, for: '1d' };
    case 'waitForEvent':
      return { type, event: '', timeout: '7d', onTimeout: 'continue' };
    case 'condition':
      return { type, match: 'all', conditions: [{ path: 'event.data.', op: 'exists' }] };
    case 'notifyStaff':
      return { type, permission: 'admin.access', title: '', body: '' };
    case 'notifyContact':
      return { type, contactId: '{{event.data.contactId}}', title: '', body: '' };
    case 'sendEmail':
      return { type, contactId: '{{event.data.contactId}}', subject: '', body: '' };
    case 'sendText':
      return { type, contactId: '{{event.data.contactId}}', text: '' };
    default:
      return { type: 'webhook', url: 'https://' };
  }
};

export function AutomationBuilder({
  id,
  initial,
  events,
  actions,
  permissions,
}: {
  /** Set when editing. */
  id?: string;
  initial?: DefinitionInput;
  events: { type: string; description: string }[];
  actions: { name: string; title: string }[];
  permissions: string[];
}) {
  const { run, pending } = useAction();
  const router = useRouter();
  const hasBranch = JSON.stringify(initial?.steps ?? []).includes('"type":"branch"');
  const [mode, setMode] = useState<'form' | 'json'>(hasBranch ? 'json' : 'form');
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [triggerKind, setTriggerKind] = useState<'event' | 'every' | 'daily'>(
    initial?.trigger.type === 'schedule' ? (initial.trigger.dailyAt ? 'daily' : 'every') : 'event',
  );
  const t = initial?.trigger;
  const [event, setEvent] = useState(t?.type === 'event' ? t.event : (events[0]?.type ?? ''));
  const [every, setEvery] = useState(String(t?.type === 'schedule' ? (t.everyMinutes ?? 60) : 60));
  const [dailyAt, setDailyAt] = useState(t?.type === 'schedule' ? (t.dailyAt ?? '08:30') : '08:30');
  const [conditions, setConditions] = useState<Cond[]>(
    (initial?.conditions ?? []).map((c) => ({
      path: c.path,
      op: c.op,
      value: c.value === undefined ? '' : String(c.value),
    })),
  );
  const [steps, setSteps] = useState<Row[]>(
    (initial?.steps as Row[] | undefined) ?? [blank('wait')],
  );
  const [extra] = useState(() => ({
    tags: initial?.tags ?? [],
    cancelOn: initial?.cancelOn ?? [],
    concurrencyKey: initial?.concurrencyKey ?? null,
  }));
  const definition = (): DefinitionInput => ({
    name,
    description: description || null,
    ...extra,
    trigger:
      triggerKind === 'event'
        ? { type: 'event', event }
        : triggerKind === 'every'
          ? { type: 'schedule', everyMinutes: Number(every) }
          : { type: 'schedule', dailyAt },
    conditions: conditions.map((c) => ({
      path: c.path,
      op: c.op as never,
      ...(c.value !== '' && { value: c.value }),
    })),
    steps: steps as never,
  });
  const [json, setJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const switchMode = (next: 'form' | 'json') => {
    if (next === 'json') setJson(JSON.stringify(definition(), null, 2));
    else {
      try {
        const d = JSON.parse(json) as DefinitionInput;
        setName(d.name ?? '');
        setDescription(d.description ?? '');
        if (d.trigger.type === 'event') {
          setTriggerKind('event');
          setEvent(d.trigger.event);
        } else if (d.trigger.dailyAt) {
          setTriggerKind('daily');
          setDailyAt(d.trigger.dailyAt);
        } else {
          setTriggerKind('every');
          setEvery(String(d.trigger.everyMinutes ?? 60));
        }
        setConditions(
          (d.conditions ?? []).map((c) => ({
            path: c.path,
            op: c.op,
            value: c.value === undefined ? '' : String(c.value),
          })),
        );
        setSteps((d.steps as Row[]) ?? []);
      } catch {
        // Expected: the JSON the person typed is not valid yet; tell them instead of switching.
        setJsonError('That JSON is not valid yet.');
        return;
      }
    }
    setJsonError(null);
    setMode(next);
  };

  const save = async () => {
    let body: DefinitionInput;
    if (mode === 'json') {
      try {
        body = JSON.parse(json) as DefinitionInput;
      } catch {
        // Expected: invalid JSON typed by a person.
        setJsonError('That JSON is not valid yet.');
        return;
      }
    } else body = definition();
    const res = id
      ? await run<{ id: string }>(
          'automations.update',
          { id, definition: body },
          { success: 'Saved' },
        )
      : await run<{ id: string }>(
          'automations.create',
          { definition: body, enabled: false },
          { success: 'Created. It starts off: test it, then turn it on.' },
        );
    if (res.ok) router.push(`/admin/automations/${res.data.id}`);
  };

  const setStep = (i: number, patch: Record<string, unknown>) =>
    setSteps((all) => all.map((s, n) => (n === i ? { ...s, ...patch } : s)));
  const move = (i: number, by: number) =>
    setSteps((all) => {
      const next = [...all];
      const [item] = next.splice(i, 1);
      next.splice(i + by, 0, item!);
      return next;
    });

  return (
    <div className="grid gap-4">
      {hasBranch && mode === 'form' && (
        <Callout tone="info">
          This automation has if/else branches, which are edited in the JSON tab.
        </Callout>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={mode === 'form' ? 'primary' : 'secondary'}
          onClick={() => switchMode('form')}
        >
          Builder
        </Button>
        <Button
          variant={mode === 'json' ? 'primary' : 'secondary'}
          onClick={() => switchMode('json')}
        >
          JSON
        </Button>
      </div>
      {jsonError && <Callout tone="danger">{jsonError}</Callout>}

      {mode === 'json' ? (
        <Field label="Definition" hint="The same JSON the API takes (automations.create).">
          <Textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            rows={22}
            className="font-mono text-xs"
            spellCheck={false}
          />
        </Field>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Name</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field label="Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
              </Field>
              <Field label="What it is for" required={false}>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>When</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field label="Starts">
                <NativeSelect
                  value={triggerKind}
                  onChange={(e) => setTriggerKind(e.target.value as 'event' | 'every' | 'daily')}
                >
                  <option value="event">When something happens</option>
                  <option value="every">Every few minutes</option>
                  <option value="daily">Once a day</option>
                </NativeSelect>
              </Field>
              {triggerKind === 'event' && (
                <Field label="Event" hint={events.find((e) => e.type === event)?.description}>
                  <NativeSelect value={event} onChange={(e) => setEvent(e.target.value)}>
                    {events.map((e) => (
                      <option key={e.type} value={e.type}>
                        {e.type}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              )}
              {triggerKind === 'every' && (
                <Field label="Every (minutes, at least 5)">
                  <Input
                    type="number"
                    min={5}
                    value={every}
                    onChange={(e) => setEvery(e.target.value)}
                  />
                </Field>
              )}
              {triggerKind === 'daily' && (
                <Field label="At (24-hour time in the app’s time zone)">
                  <Input
                    value={dailyAt}
                    onChange={(e) => setDailyAt(e.target.value)}
                    placeholder="08:30"
                  />
                </Field>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Only if</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {conditions.map((c, i) => (
                <div
                  key={i}
                  className="grid gap-2 sm:grid-cols-[1fr_9rem_1fr_auto] sm:items-center"
                >
                  <Input
                    aria-label="Value to check"
                    value={c.path}
                    onChange={(e) =>
                      setConditions((all) =>
                        all.map((x, n) => (n === i ? { ...x, path: e.target.value } : x)),
                      )
                    }
                    placeholder="event.data.tags"
                  />
                  <NativeSelect
                    aria-label="Operator"
                    value={c.op}
                    onChange={(e) =>
                      setConditions((all) =>
                        all.map((x, n) => (n === i ? { ...x, op: e.target.value } : x)),
                      )
                    }
                  >
                    {OPS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </NativeSelect>
                  <Input
                    aria-label="Compared with"
                    value={c.value}
                    onChange={(e) =>
                      setConditions((all) =>
                        all.map((x, n) => (n === i ? { ...x, value: e.target.value } : x)),
                      )
                    }
                    placeholder="lead"
                  />
                  <Button
                    aria-label="Remove condition"
                    size="sm"
                    icon={<TrashIcon />}
                    onClick={() => setConditions((all) => all.filter((_, n) => n !== i))}
                  />
                </div>
              ))}
              <div>
                <Button
                  size="sm"
                  icon={<PlusIcon />}
                  onClick={() =>
                    setConditions((all) => [
                      ...all,
                      { path: 'event.data.', op: 'equals', value: '' },
                    ])
                  }
                >
                  Add a condition
                </Button>
              </div>
            </CardContent>
          </Card>

          {steps.map((s, i) => (
            <Card key={i}>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle>Step {i + 1}</CardTitle>
                <div className="flex gap-1">
                  <Button
                    aria-label="Move up"
                    size="sm"
                    icon={<ArrowUpIcon />}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  />
                  <Button
                    aria-label="Move down"
                    size="sm"
                    icon={<ArrowDownIcon />}
                    disabled={i === steps.length - 1}
                    onClick={() => move(i, 1)}
                  />
                  <Button
                    aria-label="Remove step"
                    size="sm"
                    icon={<TrashIcon />}
                    onClick={() => setSteps((all) => all.filter((_, n) => n !== i))}
                  />
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Field label="What it does">
                  <NativeSelect
                    value={s.type}
                    onChange={(e) => setStep(i, { ...blank(e.target.value), id: s.id })}
                  >
                    {STEP_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                    {s.type === 'branch' && <option value="branch">If / else</option>}
                  </NativeSelect>
                </Field>
                <StepFields
                  step={s}
                  set={(patch) => setStep(i, patch)}
                  events={events}
                  actions={actions}
                  permissions={permissions}
                />
              </CardContent>
            </Card>
          ))}
          <div>
            <Button
              icon={<PlusIcon />}
              onClick={() => setSteps((all) => [...all, blank('notifyStaff')])}
            >
              Add a step
            </Button>
          </div>
        </>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={() => router.back()}>Cancel</Button>
        <Button variant="primary" loading={pending} onClick={save}>
          {id ? 'Save changes' : 'Create automation'}
        </Button>
      </div>
    </div>
  );
}

function StepFields({
  step: s,
  set,
  events,
  actions,
  permissions,
}: {
  step: Row;
  set: (patch: Record<string, unknown>) => void;
  events: { type: string }[];
  actions: { name: string; title: string }[];
  permissions: string[];
}) {
  const text = (key: string, label: string, opts: { area?: boolean; hint?: string } = {}) => (
    <Field label={label} hint={opts.hint}>
      {opts.area ? (
        <Textarea
          rows={3}
          value={String(s[key] ?? '')}
          onChange={(e) => set({ [key]: e.target.value })}
        />
      ) : (
        <Input value={String(s[key] ?? '')} onChange={(e) => set({ [key]: e.target.value })} />
      )}
    </Field>
  );
  switch (s.type) {
    case 'action':
      return (
        <>
          <Field label="Action">
            <NativeSelect
              value={String(s.action ?? '')}
              onChange={(e) => set({ action: e.target.value })}
            >
              <option value="">Choose…</option>
              {actions.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.name}: {a.title}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <JsonField
            label="Input (JSON; templates allowed)"
            value={s.input}
            onChange={(v) => set({ input: v })}
          />
        </>
      );
    case 'wait':
      return text('for', 'For how long', { hint: 'A number and m, h, d or w: 30m, 2h, 3d, 1w.' });
    case 'waitForEvent':
      return (
        <>
          <Field label="Event">
            <NativeSelect
              value={String(s.event ?? '')}
              onChange={(e) => set({ event: e.target.value })}
            >
              <option value="">Choose…</option>
              {events.map((e) => (
                <option key={e.type}>{e.type}</option>
              ))}
            </NativeSelect>
          </Field>
          {text('timeout', 'Give up after', { hint: 'e.g. 7d' })}
          <Field label="If it never happens">
            <NativeSelect
              value={String(s.onTimeout ?? 'continue')}
              onChange={(e) => set({ onTimeout: e.target.value })}
            >
              <option value="continue">Carry on</option>
              <option value="stop">Stop the run</option>
            </NativeSelect>
          </Field>
        </>
      );
    case 'condition':
      return (
        <p className="text-sm text-muted-foreground">
          Edit conditions in the JSON tab (the run stops here unless they hold).
        </p>
      );
    case 'notifyStaff':
      return (
        <>
          <Field label="Everyone who has this permission">
            <NativeSelect
              value={String(s.permission ?? 'admin.access')}
              onChange={(e) => set({ permission: e.target.value })}
            >
              {permissions.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </NativeSelect>
          </Field>
          {text('title', 'Title')}
          {text('body', 'Message', { area: true })}
          {text('url', 'Link (optional)', { hint: 'e.g. /admin/users/{{event.data.contactId}}' })}
        </>
      );
    case 'notifyContact':
      return (
        <>
          {text('contactId', 'Contact id', { hint: 'Usually {{event.data.contactId}}' })}
          {text('title', 'Title')}
          {text('body', 'Message', { area: true })}
          {text('sms', 'Text version (optional)', {
            hint: 'Only sent with their recorded text consent.',
          })}
        </>
      );
    case 'sendEmail':
      return (
        <>
          {text('contactId', 'Contact id', { hint: 'Usually {{event.data.contactId}}' })}
          {text('subject', 'Subject')}
          {text('body', 'Message', { area: true })}
        </>
      );
    case 'sendText':
      return (
        <>
          {text('contactId', 'Contact id', { hint: 'Usually {{event.data.contactId}}' })}
          {text('text', 'Text message', {
            area: true,
            hint: 'Only sent with their recorded text consent.',
          })}
        </>
      );
    case 'webhook':
      return text('url', 'HTTPS address', { hint: 'Receives a signed POST (x-app-signature).' });
    default:
      return <p className="text-sm text-muted-foreground">Edit this step in the JSON tab.</p>;
  }
}

/** A JSON object field that keeps what the person typed until it parses. */
function JsonField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const [text, setText] = useState(JSON.stringify(value ?? {}, null, 2));
  const [bad, setBad] = useState(false);
  return (
    <Field label={label} error={bad ? 'Not valid JSON yet.' : undefined}>
      <Textarea
        rows={5}
        className="font-mono text-xs"
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            onChange(JSON.parse(e.target.value));
            setBad(false);
          } catch {
            // Expected while typing: flag it, keep the last valid value.
            setBad(true);
          }
        }}
      />
    </Field>
  );
}
