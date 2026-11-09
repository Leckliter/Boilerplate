'use client';

import { Accordion as BaseAccordion } from '@base-ui/react/accordion';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { CaretDownIcon } from './icons';

/**
 * Accordion: stacked sections that open one at a time (or several with `multiple`). Use for FAQs
 * and long settings; for a single show/hide use Collapsible. Base UI Accordion.
 *
 *   <Accordion defaultValue={['a']}>
 *     <AccordionItem value="a" title="How do refunds work?">…</AccordionItem>
 *   </Accordion>
 */
function Accordion({ className, ...props }: React.ComponentProps<typeof BaseAccordion.Root>) {
  return (
    <BaseAccordion.Root
      data-slot="accordion"
      className={cn(
        'w-full divide-y divide-hairline rounded-lg bg-card ring ring-border',
        className,
      )}
      {...props}
    />
  );
}

function AccordionItem({
  title,
  children,
  className,
  headingLevel = 3,
  ...props
}: Omit<React.ComponentProps<typeof BaseAccordion.Item>, 'title'> & {
  title: React.ReactNode;
  /** The heading level of the trigger: 2 when the accordion sits directly under an <h1>. Default 3. */
  headingLevel?: 2 | 3 | 4;
}) {
  const Heading = `h${headingLevel}` as 'h3';
  return (
    <BaseAccordion.Item data-slot="accordion-item" className={cn('min-w-0', className)} {...props}>
      <BaseAccordion.Header render={<Heading />} className="m-0">
        <BaseAccordion.Trigger
          className={cn(
            'group flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left text-base font-medium text-foreground outline-none',
            'hover:bg-tint focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
          )}
        >
          <span className="min-w-0">{title}</span>
          <CaretDownIcon
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-data-[panel-open]:rotate-180 motion-reduce:transition-none"
          />
        </BaseAccordion.Trigger>
      </BaseAccordion.Header>
      <BaseAccordion.Panel className="h-(--accordion-panel-height) overflow-hidden text-sm text-muted-foreground transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
        <div className="px-4 pb-4">{children}</div>
      </BaseAccordion.Panel>
    </BaseAccordion.Item>
  );
}

export { Accordion, AccordionItem };
