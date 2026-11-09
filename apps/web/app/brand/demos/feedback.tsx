'use client';

import { Badge, CountBadge, TAG_COLORS } from '@app/ui/components/badge';
import { Banner } from '@app/ui/components/banner';
import { Button } from '@app/ui/components/button';
import { Callout } from '@app/ui/components/callout';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@app/ui/components/dialog';
import { Empty } from '@app/ui/components/empty';
import {
  InfoIcon,
  InboxIcon,
  WarningIcon,
  CheckCircleIcon,
  WarningOctagonIcon,
  StarIcon,
} from '@app/ui/components/icons';
import { LayerDialog } from '@app/ui/components/layer-dialog';
import { Loader } from '@app/ui/components/loader';
import { Meter } from '@app/ui/components/meter';
import { Popover } from '@app/ui/components/popover';
import { SkeletonLine } from '@app/ui/components/skeleton-line';
import { Text } from '@app/ui/components/text';
import { toast } from '@app/ui/components/toaster';
import { Tooltip } from '@app/ui/components/tooltip';
import { Skeleton } from '@app/ui/components/page';

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

const KUMO_BADGES = [
  'primary',
  'secondary',
  'error',
  'warning',
  'success',
  'info',
  'beta',
  'outline',
  'red',
  'green',
  'neutral',
  'orange',
  'purple',
  'teal',
  'teal-subtle',
  'blue',
] as const;

/** Feedback & overlays: badges, banners, callouts, toasts, dialogs, tooltips, popovers, loaders, meters, text. */
export default function FeedbackDemos() {
  return (
    <>
      <Block
        title="Badge"
        description="Small status label. Our screens pass a tag colour (color=…); Kumo's own variants work too (variant=…)."
      >
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {[...TAG_COLORS, 'solid', 'outline'].map((c) => (
              <Badge key={c} color={c as 'neutral'}>
                {c}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {KUMO_BADGES.map((v) => (
              <Badge key={v} variant={v}>
                {v}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success" appearance="dot">
              Healthy
            </Badge>
            <Badge variant="warning" appearance="dot">
              Degraded
            </Badge>
            <Badge variant="error" appearance="dot">
              Down
            </Badge>
            <Badge variant="neutral" appearance="dot">
              Idle
            </Badge>
            <Badge variant="info" icon={<InfoIcon />}>
              With icon
            </Badge>
            <span className="inline-flex items-center gap-2 text-sm">
              CountBadge <CountBadge count={3} /> <CountBadge count={120} />
            </span>
          </div>
        </div>
      </Block>

      <Block
        title="Banner"
        description="Kumo's tinted notice: icon, title, description, action. size=sm for dialogs. Callout is the thin wrapper our screens use."
      >
        <div className="grid max-w-2xl gap-3">
          <Banner icon={<InfoIcon weight="fill" />} text="Default banner for general messages." />
          <Banner
            variant="alert"
            icon={<WarningIcon weight="fill" />}
            title="Heads up"
            description="Payment is due in 3 days."
            action={<Banner.Action>Pay now</Banner.Action>}
          />
          <Banner
            variant="error"
            icon={<WarningOctagonIcon weight="fill" />}
            title="Charge failed"
            description="The card on file was declined."
            action={<Banner.Action variant="secondary">Update card</Banner.Action>}
          />
          <Banner variant="secondary" text="Neutral banner for secondary messages." />
          <Banner
            variant="success"
            icon={<CheckCircleIcon weight="fill" />}
            title="All set"
            description="Your changes are saved."
            action={<Banner.Action variant="ghost">View</Banner.Action>}
          />
          <Banner
            size="sm"
            variant="alert"
            icon={<WarningIcon weight="fill" />}
            title="Compact"
            description="For dialogs and tight spaces."
            action={<Banner.Action>Fix</Banner.Action>}
          />
        </div>
        <h3 className="mt-6 mb-2 text-sm font-medium">Callout</h3>
        <div className="grid max-w-2xl gap-3">
          <Callout tone="info">
            <InfoIcon /> Info: a thing you should know.
          </Callout>
          <Callout tone="warning">
            <WarningIcon /> Warning: needs attention.
          </Callout>
          <Callout tone="danger">
            <WarningOctagonIcon /> Danger: this failed.
          </Callout>
          <Callout tone="success">
            <CheckCircleIcon /> Success: all done.
          </Callout>
          <Callout tone="loud" shape="strip">
            Loud strip: this is the test site
          </Callout>
        </div>
      </Block>

      <Block
        title="Toast"
        description="toast.success / error / warning / info / toast(). Stacked bottom-right, swipe or hover to expand."
      >
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => toast('Something happened')}>Default</Button>
          <Button onClick={() => toast.success('Saved', { description: 'Your changes are live.' })}>
            Success
          </Button>
          <Button onClick={() => toast.error('Could not save')}>Error</Button>
          <Button onClick={() => toast.warning('Low stock')}>Warning</Button>
          <Button onClick={() => toast.info('FYI: new version available')}>Info</Button>
          <Button
            onClick={() =>
              toast('Note archived', { action: { label: 'Undo', onClick: () => toast('Undone') } })
            }
          >
            With action
          </Button>
        </div>
      </Block>

      <Block
        title="Dialog"
        description="DialogContent sizes: sm, base, lg, xl (leave off for the fluid default). LayerDialog is Kumo's sheet-on-phone dialog."
      >
        <div className="flex flex-wrap gap-2">
          {(['sm', 'base', 'lg', 'xl'] as const).map((size) => (
            <Dialog key={size}>
              <DialogTrigger render={<Button variant="outline" />}>Dialog {size}</DialogTrigger>
              <DialogContent size={size}>
                <DialogHeader>
                  <DialogTitle>Dialog ({size})</DialogTitle>
                  <DialogDescription>Rings, a soft scale-in, and a close button.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="secondary" />}>Close</DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ))}
          <LayerDialog>
            <LayerDialog.Trigger render={<Button variant="outline" />}>
              LayerDialog
            </LayerDialog.Trigger>
            <LayerDialog.Content>
              <LayerDialog.Title>Edit details</LayerDialog.Title>
              <LayerDialog.Description>A bottom sheet on phones.</LayerDialog.Description>
              <LayerDialog.Body>
                <p className="text-sm text-muted-foreground">
                  Scroll the body; the header and actions stay put.
                </p>
              </LayerDialog.Body>
              <LayerDialog.Actions>
                <LayerDialog.Action>Save</LayerDialog.Action>
              </LayerDialog.Actions>
            </LayerDialog.Content>
          </LayerDialog>
          <LayerDialog.Alert>
            <LayerDialog.Trigger render={<Button variant="destructive" />}>
              LayerDialog alert
            </LayerDialog.Trigger>
            <LayerDialog.Content size="sm">
              <LayerDialog.Title>Delete this?</LayerDialog.Title>
              <LayerDialog.Body>This cannot be undone.</LayerDialog.Body>
              <LayerDialog.Actions>
                <LayerDialog.Action variant="destructive">Delete</LayerDialog.Action>
              </LayerDialog.Actions>
            </LayerDialog.Content>
          </LayerDialog.Alert>
        </div>
      </Block>

      <Block
        title="Tooltip & Popover"
        description="Both scale in with an arrow. Tooltip wraps the element you hover."
      >
        <div className="flex flex-wrap items-center gap-3">
          {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
            <Tooltip key={side} content={`Tooltip on the ${side}`} side={side}>
              <Button variant="outline">{side}</Button>
            </Tooltip>
          ))}
          <Popover>
            <Popover.Trigger render={<Button variant="secondary" />}>Open popover</Popover.Trigger>
            <Popover.Content className="max-w-64">
              <Popover.Title>Popover</Popover.Title>
              <Popover.Description>Anchored to the button, closes on Esc.</Popover.Description>
              <Popover.Close render={<Button size="sm" className="mt-3" />}>Got it</Popover.Close>
            </Popover.Content>
          </Popover>
        </div>
      </Block>

      <Block title="Loader, skeleton & meter">
        <div className="grid max-w-md gap-6">
          <div className="flex items-center gap-4 text-muted-foreground">
            <Loader size="sm" />
            <Loader />
            <Loader size="lg" />
            <Loader size={48} />
          </div>
          <div className="grid gap-2">
            <SkeletonLine />
            <SkeletonLine />
            <SkeletonLine variant="sketch" />
            <Skeleton className="h-8 w-full" />
          </div>
          <Meter value={32} label="Storage" />
          <Meter value={80} label="Quota" customValue="8 of 10 seats" />
        </div>
      </Block>

      <Block
        title="Empty"
        description="Empty: an optional icon, a title, a description and free-form contents (buttons)."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Empty
            size="sm"
            icon={<InboxIcon />}
            title="No projects yet"
            description="Projects show up here when someone creates one."
            contents={<Button variant="primary">Create project</Button>}
          />
          <Empty
            icon={<StarIcon />}
            title="Nothing starred"
            description="Star a record to pin it here."
            contents={<Button size="sm">Browse</Button>}
          />
          <Empty size="sm" title="Install the CLI" commandLine="pnpm add @app/ui" />
        </div>
      </Block>

      <Block title="Text" description="Text is the typography primitive.">
        <div className="grid max-w-xl gap-2">
          <Text variant="heading" size="lg" as="h3">
            Heading lg
          </Text>
          <Text variant="heading">Heading</Text>
          <Text>Body text</Text>
          <Text bold>Body bold</Text>
          <Text variant="secondary">Secondary</Text>
          <Text variant="success">Success</Text>
          <Text variant="error">Error</Text>
          <Text variant="mono">mono text</Text>
          <Text variant="mono-secondary">mono secondary</Text>
          <Text size="xs">xs</Text>
          <Text size="sm">sm</Text>
          <Text truncate>
            A very long line that truncates when it runs out of room in its box, like this one.
          </Text>
        </div>
      </Block>
    </>
  );
}
