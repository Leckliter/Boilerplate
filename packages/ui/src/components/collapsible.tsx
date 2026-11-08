'use client';

import { Collapsible as CollapsibleBase } from '@base-ui/react/collapsible';
import type { ReactNode } from 'react';

import { cn } from '../lib/utils';
import { CaretDownIcon } from './icons';

/**
 * Root: manages the open state.
 * ```tsx
 * <Collapsible.Root>
 *   <Collapsible.DefaultTrigger>Show details</Collapsible.DefaultTrigger>
 *   <Collapsible.DefaultPanel>Content</Collapsible.DefaultPanel>
 * </Collapsible.Root>
 * ```
 */
export type CollapsibleRootProps = CollapsibleBase.Root.Props;
function CollapsibleRoot(props: CollapsibleRootProps) {
  return <CollapsibleBase.Root data-slot="collapsible" {...props} />;
}

/** The toggle. Use `render={<Button variant="ghost" />}` for a custom element. */
export type CollapsibleTriggerProps = CollapsibleBase.Trigger.Props;
function CollapsibleTrigger({ className, ...props }: CollapsibleTriggerProps) {
  return (
    <CollapsibleBase.Trigger
      data-slot="collapsible-trigger"
      className={(state) =>
        cn('cursor-pointer', typeof className === 'function' ? className(state) : className)
      }
      {...props}
    />
  );
}

/** The content that shows when open. */
export type CollapsiblePanelProps = CollapsibleBase.Panel.Props;
function CollapsiblePanel(props: CollapsiblePanelProps) {
  return <CollapsibleBase.Panel data-slot="collapsible-panel" {...props} />;
}

/** Pre-styled trigger: label and an animated caret. */
function CollapsibleDefaultTrigger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <CollapsibleBase.Trigger
      data-slot="collapsible-default-trigger"
      className={cn(
        // Resets so global button styles can't leak in.
        'm-0 border-none bg-transparent p-0 shadow-none',
        'flex cursor-pointer items-center gap-1 text-base font-medium text-foreground select-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        className,
      )}
    >
      <span>{children}</span>
      <span className="inline-grid w-4 shrink-0 place-items-center">
        <CaretDownIcon
          aria-hidden
          size={12}
          weight="bold"
          className="block size-3 origin-center transition-transform duration-100 ease-out [[data-panel-open]_&]:rotate-180"
        />
      </span>
    </CollapsibleBase.Trigger>
  );
}

/** Pre-styled panel: animated height with a left accent line. */
function CollapsibleDefaultPanel({
  children,
  className,
  ...props
}: CollapsiblePanelProps & { children: ReactNode }) {
  return (
    <CollapsibleBase.Panel
      data-slot="collapsible-default-panel"
      className={(state) =>
        cn(
          "h-[var(--collapsible-panel-height)] overflow-hidden transition-[height,opacity] duration-100 ease-out data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 [&[hidden]:not([hidden='until-found'])]:hidden",
          typeof className === 'function' ? className(state) : className,
        )
      }
      {...props}
    >
      <div className="my-2 space-y-4 border-l-2 border-fill py-1 pr-1 pl-4">{children}</div>
    </CollapsibleBase.Panel>
  );
}

export const Collapsible = Object.assign(CollapsibleRoot, {
  Root: CollapsibleRoot,
  Trigger: CollapsibleTrigger,
  Panel: CollapsiblePanel,
  DefaultTrigger: CollapsibleDefaultTrigger,
  DefaultPanel: CollapsibleDefaultPanel,
});

export type CollapsibleProps = CollapsibleRootProps;

export {
  CollapsibleRoot,
  CollapsibleTrigger,
  CollapsiblePanel,
  CollapsibleDefaultTrigger,
  CollapsibleDefaultPanel,
};
