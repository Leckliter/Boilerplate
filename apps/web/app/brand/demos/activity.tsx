'use client';

import { Accordion, AccordionItem } from '@app/ui/components/accordion';
import { Card, CardContent } from '@app/ui/components/card';
import {
  CheckIcon,
  PackageIcon,
  PaperPlaneTiltIcon,
  ReceiptIcon,
  TruckIcon,
} from '@app/ui/components/icons';
import { Input } from '@app/ui/components/input';
import { Field } from '@app/ui/components/label';
import { KeyValueList } from '@app/ui/components/key-value-list';
import { NotificationList, type NotificationItem } from '@app/ui/components/notification-list';
import { Pill, StatusDot, type PillTone } from '@app/ui/components/pill';
import { Progress } from '@app/ui/components/progress';
import { Timeline } from '@app/ui/components/timeline';
import { Wizard } from '@app/ui/components/wizard';
import { useEffect, useState } from 'react';

function Block({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-3">
      <h3 className="text-base font-semibold">{title}</h3>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      {children}
    </div>
  );
}

const NOTES: NotificationItem[] = [
  {
    id: '1',
    title: 'Order A-1042 shipped',
    body: 'Arrives Thursday.',
    at: '2026-11-03T15:20:00Z',
    read: false,
    icon: <TruckIcon />,
  },
  {
    id: '2',
    title: 'Payment received',
    body: '$129.00 from Ada Lovelace',
    at: '2026-11-02T18:05:00Z',
    read: false,
    icon: <ReceiptIcon />,
  },
  { id: '3', title: 'Welcome aboard', at: '2026-10-28T09:00:00Z', read: true },
];

function ProgressDemo() {
  const [v, setV] = useState(20);
  useEffect(() => {
    const t = setInterval(() => setV((x) => (x >= 100 ? 0 : x + 10)), 900);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="grid max-w-md gap-4">
      <Progress label="Importing contacts" value={v} />
      <Progress label="Working on it" value={null} />
      <Progress label="Done" value={100} tone="success" />
      <Progress label="Failed at 62%" value={62} tone="danger" />
    </div>
  );
}

function WizardDemo() {
  const [name, setName] = useState('');
  const [done, setDone] = useState(false);
  if (done)
    return (
      <p className="text-sm text-success">
        Finished: the wizard called onFinish (reset by reloading).
      </p>
    );
  return (
    <Card>
      <CardContent>
        <Wizard
          onFinish={() => setDone(true)}
          finishLabel="Create project"
          steps={[
            {
              id: 'name',
              label: 'Name',
              description: 'Next stays disabled until the step is valid.',
              valid: name.trim().length > 1,
              content: (
                <Field label="Project name" hint="At least two characters.">
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
              ),
            },
            {
              id: 'team',
              label: 'Team',
              content: <p className="text-sm text-muted-foreground">Invite people here.</p>,
            },
            {
              id: 'review',
              label: 'Review',
              content: (
                <KeyValueList
                  items={[
                    { label: 'Name', value: name },
                    { label: 'Team', value: 'Just you' },
                  ]}
                />
              ),
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}

export function ActivityDemos() {
  const [notes, setNotes] = useState(NOTES);
  const tones: PillTone[] = ['neutral', 'brand', 'success', 'warning', 'danger', 'info'];
  return (
    <div className="grid gap-12">
      <Block
        title="Pill and StatusDot"
        note="Colour carries a state, never alone: Pill has words, StatusDot has a spoken label."
      >
        <div className="flex flex-wrap items-center gap-2">
          {tones.map((t) => (
            <Pill key={t} tone={t} dot>
              {t}
            </Pill>
          ))}
          <Pill tone="success" size="sm">
            small
          </Pill>
        </div>
        <div className="flex flex-wrap items-center gap-5 text-sm">
          <span className="flex items-center gap-2">
            <StatusDot tone="success" label="Online" pulse /> Online
          </span>
          <span className="flex items-center gap-2">
            <StatusDot tone="warning" label="Degraded" /> Degraded
          </span>
          <span className="flex items-center gap-2">
            <StatusDot tone="danger" label="Offline" /> Offline
          </span>
          <span className="flex items-center gap-2">
            <StatusDot label="Unknown" /> Unknown
          </span>
        </div>
      </Block>
      <Block title="Timeline" note="Activity and history. Times are shown in the app time zone.">
        <Card>
          <CardContent>
            <Timeline
              items={[
                {
                  id: '1',
                  title: 'Order shipped',
                  description: 'Carrier: UPS, 1Z999AA10123456784',
                  at: '2026-11-03T15:20:00Z',
                  icon: <TruckIcon />,
                  tone: 'brand',
                  actor: 'Sam',
                },
                {
                  id: '2',
                  title: 'Payment received',
                  at: '2026-11-02T18:05:00Z',
                  icon: <CheckIcon />,
                  tone: 'success',
                  actor: 'Stripe',
                },
                {
                  id: '3',
                  title: 'Receipt emailed',
                  at: '2026-11-02T18:05:30Z',
                  icon: <PaperPlaneTiltIcon />,
                  actor: 'System',
                },
                {
                  id: '4',
                  title: 'Order placed',
                  at: '2026-11-02T18:04:00Z',
                  icon: <PackageIcon />,
                },
              ]}
            />
          </CardContent>
        </Card>
      </Block>
      <Block
        title="NotificationList"
        note="Presentational: items in, onMarkRead / onMarkAllRead out. Try marking one read."
      >
        <Card className="max-w-lg">
          <NotificationList
            items={notes}
            onMarkRead={(id) =>
              setNotes((n) => n.map((x) => (x.id === id ? { ...x, read: true } : x)))
            }
            onMarkAllRead={() => setNotes((n) => n.map((x) => ({ ...x, read: true })))}
          />
        </Card>
      </Block>
      <Block title="KeyValueList">
        <Card className="max-w-lg">
          <CardContent>
            <KeyValueList
              items={[
                { label: 'Plan', value: 'Pro, billed yearly', hint: 'Renews Jan 4, 2027' },
                { label: 'Seats', value: '4 of 10' },
                {
                  label: 'Billing email',
                  value: 'a-very-long-address-that-must-wrap@example-company.com',
                },
              ]}
            />
          </CardContent>
        </Card>
      </Block>
      <Block title="Accordion" note="One open at a time by default; add `multiple` for several.">
        <Accordion defaultValue={['refunds']} className="max-w-xl">
          <AccordionItem value="refunds" title="How do refunds work?" headingLevel={4}>
            Refunds go back to the original payment method within 5 business days.
          </AccordionItem>
          <AccordionItem value="ship" title="Where do you ship?" headingLevel={4}>
            Anywhere in the contiguous United States.
          </AccordionItem>
          <AccordionItem value="support" title="How do I reach support?" headingLevel={4}>
            Use the help button, or email us. We answer within one business day.
          </AccordionItem>
        </Accordion>
      </Block>
      <Block
        title="Progress"
        note="A task's progress. For quantity against a limit (storage) use Meter."
      >
        <ProgressDemo />
      </Block>
      <Block
        title="Wizard"
        note="Steps, Back / Next / Finish, focus moves to the new step's heading."
      >
        <WizardDemo />
      </Block>
    </div>
  );
}
