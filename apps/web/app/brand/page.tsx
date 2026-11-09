import { Avatar } from '@app/ui/components/avatar';
import { Badge, TAG_COLORS, tagColor } from '@app/ui/components/badge';
import { Callout } from '@app/ui/components/callout';
import { Checkbox, CheckboxField } from '@app/ui/components/checkbox';
import { CopyButton, ErrorReference } from '@app/ui/components/copy-button';
import { Button, buttonVariants } from '@app/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@app/ui/components/card';
import { Input, NativeSelect, Textarea } from '@app/ui/components/input';
import { Field } from '@app/ui/components/label';
import { Logo } from '@app/ui/components/logo';
import { PageHeader, RecordHeader, Skeleton } from '@app/ui/components/page';
import { Empty } from '@app/ui/components/empty';
import { Steps } from '@app/ui/components/steps';
import { SummaryList, SummaryRow } from '@app/ui/components/summary';
import { Prose } from '@app/ui/components/prose';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@app/ui/components/table';
import { AlarmIcon, PlusIcon, TrashIcon, TrayIcon, WarningIcon } from '@app/ui/components/icons';
import type { Metadata } from 'next';
import Link from 'next/link';

import { BrandNav, type BrandNavGroup } from '@/components/brand/brand-nav';
import { ColorTokens } from '@/components/brand/color-tokens';
import {
  AccessibilityChecklist,
  SpacingRadiusShadow,
  TypographyScale,
  VoiceAndCopy,
} from '@/components/brand/foundations';
import { MotionDemo } from '@/components/brand/motion-demo';
import { BrandSection } from '@/components/brand/section';
import { slug } from '@/components/brand/slug';

import { AlertDialogDemo } from './alert-dialog-demo';
import { CalendarDemo } from './calendar-demo';
import { CommandPaletteDemo } from './command-palette-demo';
import { EditableCardDemo } from './editable-card-demo';
import { KitDemos } from './kit-demos';
import { ThemeSwitch } from '@/components/layout/theme-switch';
import { ExtrasDemos } from './extras-demos';
import { IconsGallery } from './icons-gallery';
import { FileDropDemo } from './file-drop-demo';
import { InteractiveDemos } from './interactive-demos';
import FeedbackDemos from './demos/feedback';
import FormsDemos from './demos/forms';
import NavigationDemos from './demos/navigation';
import { ActivityDemos } from './demos/activity';
import { DataDemos } from './demos/data';
import { InputDemos } from './demos/inputs';
import { PatternDemos } from './demos/patterns';

export const metadata: Metadata = {
  title: 'Brand & UI kit',
  description: 'The design system — every token and component, live.',
};

/** The table of contents: group → section titles (each title's slug is its anchor id). */
const NAV: BrandNavGroup[] = [
  {
    title: 'Foundations',
    sections: [
      'Logo',
      'Colour tokens',
      'Typography',
      'Spacing, radius & shadow',
      'Icons',
      'Motion',
      'Accessibility',
      'Voice & copy',
    ],
  },
  {
    title: 'Components',
    sections: [
      'Buttons',
      'Form controls',
      'Badges & tag colours',
      'Callouts',
      'Cards',
      'Record details',
      'Steps',
      'Table',
      'Overlays & feedback',
      'More building blocks',
      'Command palette',
      'Asking first',
      'Checkboxes',
      'File uploads',
      'Errors & copying',
      'Calendar',
      'More components',
      'Page building blocks',
      'Loading',
      'Prose',
    ],
  },
  { title: 'Data & activity', sections: ['Data display', 'Activity & status', 'Inputs & actions'] },
  { title: 'Patterns', sections: ['Patterns', 'Rules'] },
];

/**
 * Living style guide. If it's not on this page, it's not part of the system.
 * Add new components here when you add them to packages/ui: a demo under ./demos, a Section
 * below, and its title in NAV above.
 */
export default function BrandPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        title="Brand & UI kit"
        description="Neutral greys, one brand colour, shadcn/ui component names on Base UI. Source: packages/ui."
        actions={
          <>
            <ThemeSwitch />
            <Link href="/" className={buttonVariants()}>
              Back to site
            </Link>
          </>
        }
      />
      <div className="lg:flex lg:gap-10">
        <BrandNav groups={NAV} />
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          <Section
            title="Logo"
            description="Use <Logo /> in the app; it takes its colour from tokens. Replace the body of packages/ui/src/components/logo.tsx with your artwork."
          >
            <div className="flex flex-wrap items-center gap-8">
              <Logo className="h-12" />
              <Logo compact className="size-12" />
              <div className="flex items-center gap-6 rounded-xl bg-primary px-6 py-4">
                <Logo tone="onBrand" className="h-10" />
                <Logo compact tone="onBrand" className="h-10" />
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Full logo by default; <code className="font-mono text-xs">compact</code> (the mark
              alone) where space is tight, like the sidebar. On a brand-coloured background pass{' '}
              <code className="font-mono text-xs">tone=&quot;onBrand&quot;</code>: the mark inverts
              so it stays visible.
            </p>
          </Section>

          <Section
            title="Colour tokens"
            description="Read live from packages/ui/src/styles/globals.css: every token in light and dark, and the contrast of the real text pairs. Use the token, never a hex code."
          >
            <ColorTokens />
          </Section>

          <Section title="Typography" description="One typeface, a short scale, sentence case.">
            <TypographyScale />
          </Section>

          <Section
            title="Spacing, radius & shadow"
            description="The few values the whole UI is built from."
          >
            <SpacingRadiusShadow />
          </Section>

          <Section
            title="Icons"
            description="Phosphor, light weight by default, from @app/ui/components/icons only. Click one to copy its name."
          >
            <IconsGallery />
          </Section>

          <Section title="Motion" description="Short, purposeful, and off when asked.">
            <MotionDemo />
          </Section>

          <Section
            title="Accessibility"
            description="The checklist every screen and component meets."
          >
            <AccessibilityChecklist />
          </Section>

          <Section title="Voice & copy" description="How we write. Edit to match your product.">
            <VoiceAndCopy />
          </Section>

          <Section
            title="Buttons"
            description="One primary button per screen. Secondary is the default."
          >
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary">Primary</Button>
              <Button>Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">
                <TrashIcon /> Destructive
              </Button>
              <Button variant="link">Link</Button>
              <Button disabled>Disabled</Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="xs">Extra small</Button>
              <Button size="sm">Small</Button>
              <Button>Medium</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" aria-label="Add">
                <PlusIcon />
              </Button>
            </div>
          </Section>

          <Section
            title="Form controls"
            description="Always wrap a control in <Field> so labels, hints and errors look the same everywhere."
          >
            <div className="grid max-w-xl gap-4">
              <Field label="Name" htmlFor="demo-name" hint="As it appears on the driver’s licence.">
                <Input id="demo-name" placeholder="Avery Stone" />
              </Field>
              <Field
                label="Email"
                htmlFor="demo-email"
                error="That doesn’t look like an email address."
              >
                <Input id="demo-email" aria-invalid defaultValue="avery@" />
              </Field>
              <Field label="Contact type" htmlFor="demo-type">
                <NativeSelect id="demo-type">
                  <option>Customer</option>
                  <option>Lead</option>
                </NativeSelect>
              </Field>
              <Field label="Notes" htmlFor="demo-notes">
                <Textarea id="demo-notes" placeholder="Anything we should know?" />
              </Field>
            </div>
          </Section>

          <Section
            title="Badges & tag colours"
            description="Tags pick one of these colour keys; it's stored on the tag."
          >
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map((c) => (
                <Badge key={c} color={c} className="capitalize">
                  {c}
                </Badge>
              ))}
              <Badge color="solid">Solid</Badge>
              <Badge color="outline">Outline</Badge>
            </div>
          </Section>

          <Section
            title="Callouts"
            description="Notices that need attention. Never hand-build an amber or red box — use Callout, or calloutVariants() on a Link."
          >
            <div className="grid gap-3">
              <Callout tone="warning">
                <WarningIcon /> Two items are short for this request.
              </Callout>
              <Callout tone="danger">
                <AlarmIcon /> Late payment: $45.00 unpaid, 6 days late.
              </Callout>
              <Callout tone="info">Delivery windows open next week.</Callout>
              <Callout tone="success">Payment received — thanks!</Callout>
              <Callout tone="warning" shape="banner">
                <WarningIcon /> Banner: full-width strip under the header.
              </Callout>
              <Callout tone="loud" shape="strip">
                TEST SITE — the strip on every non-production page.
              </Callout>
            </div>
          </Section>

          <Section
            title="Cards"
            description="Surfaces are rounded-xl with a hairline border and the faintest shadow."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Card title</CardTitle>
                  <CardDescription>Supporting text explains what the card is for.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm">Content goes here.</CardContent>
                <CardFooter>
                  <Button size="sm" variant="primary">
                    Action
                  </Button>
                  <Button size="sm" variant="ghost">
                    Cancel
                  </Button>
                </CardFooter>
              </Card>
              <Card>
                <Empty
                  icon={<TrayIcon />}
                  title="Empty state"
                  description="Say what will appear here and how to make it appear."
                />
              </Card>
            </div>
          </Section>

          <Section
            title="Record details"
            description="A record page starts with RecordHeader (long titles wrap) and shows its details read-only (DetailList), one card per section; totals use SummaryList. Edit turns just that card into a form with Save / Cancel; Esc cancels and unsaved changes ask before leaving. Use EditableCard — never leave a record's fields permanently open as a form."
          >
            <div className="grid gap-6">
              <Card className="p-5">
                <RecordHeader
                  back={<Link href="/brand">← Contacts</Link>}
                  leading={<Avatar name="Avery Stone" className="size-12 text-base" />}
                  title="avery.stone.with.a.long.address@example.com"
                  badges={<Badge color="brand">Customer</Badge>}
                  meta="Person · added 11/1/2026 from website · has a login"
                  actions={<Button size="sm">Archive</Button>}
                />
              </Card>
              <EditableCardDemo />
              <Card className="max-w-sm p-5">
                <SummaryList>
                  <SummaryRow label="Top-load washer · Monthly" value="$59.00" />
                  <SummaryRow label="+ Hoses" value="Included" sub />
                  <SummaryRow label="Delivery" value="$49.00" />
                  <SummaryRow label="Due today" value="$108.00" total />
                </SummaryList>
              </Card>
            </div>
          </Section>

          <Section
            title="Steps"
            description="Where someone is in a short step-by-step flow, like checkout (details → agreement → payment). Done steps get a tick and can be clicked to go back; later steps can't be skipped to. On a phone only the current step's name shows."
          >
            <Card className="p-5">
              <Steps steps={['Your details', 'Review', 'Confirm']} current={1} />
            </Card>
          </Section>

          <Section title="Table" description="Lists of records. The whole row is the link.">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    {
                      name: 'Avery Stone',
                      email: 'avery@example.com',
                      color: 'brand',
                      tag: 'Customer',
                    },
                    {
                      name: 'Riley Brooks',
                      email: 'riley@example.com',
                      color: 'blue',
                      tag: 'Lead',
                    },
                  ].map((row) => (
                    <TableRow key={row.name}>
                      <TableCell>
                        <span className="flex items-center gap-3">
                          <Avatar name={row.name} />
                          <span className="font-medium">{row.name}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.email}</TableCell>
                      <TableCell>
                        <Badge color={tagColor(row.color)}>{row.tag}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </Section>

          <Section
            title="Overlays & feedback"
            description="Dialog, dropdown menu, tabs, tooltip and toast."
          >
            <InteractiveDemos />
          </Section>

          <Section
            title="More building blocks"
            description="Filter tabs, radio cards, text links, a loading button, count badges, a side sheet and code blocks."
          >
            <KitDemos />
          </Section>

          <Section
            title="Command palette"
            description="Kumo-style search and jump (⌘K / Ctrl K). The app shell's sits in the header and also searches records (lib/use-record-search.ts)."
          >
            <CommandPaletteDemo />
          </Section>

          <Section
            title="Asking first"
            description="Kumo's alert dialog (shadcn names): no close X, clicking outside doesn't close it, Cancel then a button that says what it does. Use await confirm() / prompt() / alert() — never the browser's window.confirm."
          >
            <AlertDialogDemo />
          </Section>

          <Section
            title="Checkboxes"
            description="Yes/no choices and consent. Always with a label; a hint says what agreeing means."
          >
            <div className="grid max-w-md gap-3">
              <CheckboxField
                label="Text me updates about this project"
                hint="Confirmations, delivery and return reminders. Reply STOP to opt out."
              />
              <CheckboxField label="Email" defaultChecked />
              <div className="flex items-center gap-4 text-sm">
                <Checkbox aria-label="On" defaultChecked /> <Checkbox aria-label="Off" />
                <Checkbox aria-label="Locked" defaultChecked disabled />
              </div>
            </div>
          </Section>

          <Section
            title="File uploads"
            description="FileDrop: click, tap or drag files in. It only picks files — the uploader (components/files) sends them to storage, with a progress line per file."
          >
            <FileDropDemo />
          </Section>

          <Section
            title="Errors & copying"
            description="When something breaks, people see an error reference they can copy and pass on (to us, or to an AI agent). CopyButton copies any value."
          >
            <div className="grid max-w-md gap-3">
              <ErrorReference reference="E-7K3QX9MD" />
              <div className="flex flex-wrap gap-2">
                <CopyButton value="E-7K3QX9MD">Copy reference</CopyButton>
                <CopyButton value="# Error E-7K3QX9MD …" variant="primary">
                  Copy for AI agent
                </CopyButton>
              </div>
            </div>
          </Section>

          <Section
            title="Calendar"
            description="CalendarWeek (day or week time grid: click an empty time, drag blocks to move), CalendarMonth (dots on phones), CalendarAgenda (the phone view and header panel) and CalendarLegend. Times show in APP_TIME_ZONE. Colours come from the kind of date."
          >
            <CalendarDemo />
          </Section>

          <Section
            title="More components"
            description="Rebuilt from Cloudflare Kumo (MIT) in @app/ui with our tokens. Each group below shows every variant, size and state."
          >
            <div className="grid gap-12">
              <div>
                <h3 className="mb-4 text-base font-semibold">Navigation and layout</h3>
                <NavigationDemos />
              </div>
              <div>
                <h3 className="mb-4 text-base font-semibold">Inputs and forms</h3>
                <FormsDemos />
              </div>
              <div>
                <h3 className="mb-4 text-base font-semibold">Feedback and overlays</h3>
                <FeedbackDemos />
              </div>
            </div>
          </Section>

          <Section
            title="Page building blocks"
            description="The toolbar above lists, loading states, the skip link, the providers and the form wiring that every screen uses."
          >
            <ExtrasDemos />
          </Section>

          <Section title="Loading" description="Skeletons match the shape of what's coming.">
            <div className="grid max-w-sm gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-9 w-full" />
            </div>
          </Section>

          <Section
            title="Prose"
            description="Long-form text — docs, policies, help. Styles plain HTML (from Markdown) with the tokens."
          >
            <Prose className="max-w-2xl">
              <h2>Getting started</h2>
              <p>
                Choose a <strong>plan</strong> or <strong>talk to us</strong> first. See{' '}
                <Link href="/docs">the docs</Link>.
              </p>
              <ul>
                <li>One request, one fee.</li>
                <li>
                  Error references look like <code>E-7K3QX9MD</code>.
                </li>
              </ul>
              <table>
                <thead>
                  <tr>
                    <th>Option</th>
                    <th>Means</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Monthly plan</td>
                    <td>Keep it as long as you like</td>
                  </tr>
                </tbody>
              </table>
            </Prose>
          </Section>

          <Section
            title="Data display"
            description="DataTable (sort, select, bulk actions, cards on phones), StatTile, and dependency-free SVG charts."
          >
            <DataDemos />
          </Section>

          <Section
            title="Activity & status"
            description="Pill, StatusDot, Timeline, NotificationList, KeyValueList, Accordion, Progress and Wizard."
          >
            <ActivityDemos />
          </Section>

          <Section
            title="Inputs & actions"
            description="SearchInput, InlineEdit, AvatarUpload, DropZone states, ConfirmButton, ThemeToggle, LanguageSelect, Kbd and the page action bars."
          >
            <InputDemos />
          </Section>

          <Section
            title="Patterns"
            description="Whole-screen recipes built from the real components: copy the shape, change the data."
          >
            <PatternDemos />
          </Section>

          <Section
            title="Rules"
            description="The short version of docs/design-system.md. `pnpm rules` checks the mechanical ones."
          >
            <ol className="grid list-decimal gap-1.5 pl-5 text-sm">
              <li>
                Tokens only: <code className="font-mono text-xs">bg-primary</code>,{' '}
                <code className="font-mono text-xs">text-muted-foreground</code>. No hex, rgb or
                palette classes.
              </li>
              <li>
                One primary button per screen; secondary is the default; destructive only after a{' '}
                <code className="font-mono text-xs">confirm()</code>.
              </li>
              <li>
                Every control sits in a <code className="font-mono text-xs">&lt;Field&gt;</code>;
                every screen starts with{' '}
                <code className="font-mono text-xs">&lt;PageHeader&gt;</code> or{' '}
                <code className="font-mono text-xs">&lt;RecordHeader&gt;</code>.
              </li>
              <li>
                Record pages show details read-only in an{' '}
                <code className="font-mono text-xs">EditableCard</code>; create pages are plain
                forms.
              </li>
              <li>
                Icons from <code className="font-mono text-xs">@app/ui/components/icons</code> only;
                tabs are <code className="font-mono text-xs">Tabs</code> /{' '}
                <code className="font-mono text-xs">FilterTabs</code>, notices are{' '}
                <code className="font-mono text-xs">Callout</code>.
              </li>
              <li>
                Works at 320px wide with no sideways scrolling; touch targets at least 40px on
                phones.
              </li>
              <li>Dark mode: surfaces get lighter with elevation, they do not invert.</li>
              <li>New component: add it to packages/ui and a demo here.</li>
            </ol>
          </Section>
        </main>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <BrandSection id={slug(title)} title={title} description={description}>
      {children}
    </BrandSection>
  );
}
