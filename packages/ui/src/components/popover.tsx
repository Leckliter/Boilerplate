'use client';

import { Popover as PopoverBase } from '@base-ui/react/popover';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { cn } from '../lib/utils';
import { usePortalContainer, type PortalContainer } from './ui-context';
import { ArrowSvg } from './tooltip';

/*
 * Popover, on Base UI. Use `<Popover.Content>` for the common case
 * (portal + positioner + popup + arrow), or the parts (`Portal`, `Positioner`, `Popup`, `Arrow`)
 * when you need control.
 *
 *   <Popover>
 *     <Popover.Trigger render={<Button>Open</Button>} />
 *     <Popover.Content><Popover.Title>Hi</Popover.Title></Popover.Content>
 *   </Popover>
 */

type PopoverSide = 'top' | 'bottom' | 'left' | 'right';

function PopoverRoot({ children, ...props }: ComponentPropsWithoutRef<typeof PopoverBase.Root>) {
  return <PopoverBase.Root {...props}>{children}</PopoverBase.Root>;
}
PopoverRoot.displayName = 'Popover';

type PopoverTriggerProps = ComponentPropsWithoutRef<typeof PopoverBase.Trigger> & {
  /** Use the single child element as the trigger (same as `render={child}`). */
  asChild?: boolean;
};

function PopoverTrigger({ children, className, asChild, render, ...props }: PopoverTriggerProps) {
  const resolvedRender =
    render ?? (asChild ? (children as PopoverTriggerProps['render']) : undefined);
  return (
    <PopoverBase.Trigger
      data-slot="popover-trigger"
      className={className}
      render={resolvedRender}
      {...props}
    >
      {asChild ? undefined : children}
    </PopoverBase.Trigger>
  );
}
PopoverTrigger.displayName = 'Popover.Trigger';

type PopoverPortalProps = Omit<ComponentPropsWithoutRef<typeof PopoverBase.Portal>, 'container'> & {
  container?: PortalContainer;
};

function PopoverPortal({ container: containerProp, ...props }: PopoverPortalProps) {
  const contextContainer = usePortalContainer();
  return (
    <PopoverBase.Portal container={containerProp ?? contextContainer ?? undefined} {...props} />
  );
}
PopoverPortal.displayName = 'Popover.Portal';

function PopoverBackdrop(props: ComponentPropsWithoutRef<typeof PopoverBase.Backdrop>) {
  return <PopoverBase.Backdrop {...props} />;
}
PopoverBackdrop.displayName = 'Popover.Backdrop';

function PopoverPositioner({
  side = 'bottom',
  sideOffset = 8,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof PopoverBase.Positioner>) {
  return (
    <PopoverBase.Positioner
      side={side}
      sideOffset={sideOffset}
      className={cn('z-100', className)}
      {...props}
    />
  );
}
PopoverPositioner.displayName = 'Popover.Positioner';

const POPUP_CLASSES =
  'flex flex-col rounded-lg bg-card px-4 py-3 text-sm text-foreground shadow-md outline outline-border';

function PopoverPopup({ className, ...props }: ComponentPropsWithoutRef<typeof PopoverBase.Popup>) {
  return (
    <PopoverBase.Popup
      data-slot="popover-popup"
      className={(state) =>
        cn(
          POPUP_CLASSES,
          'origin-(--transform-origin) transition-[transform,scale,opacity] duration-150',
          'data-starting-style:scale-90 data-starting-style:opacity-0',
          'data-ending-style:scale-90 data-ending-style:opacity-0',
          'data-instant:duration-0',
          typeof className === 'function' ? className(state) : className,
        )
      }
      {...props}
    />
  );
}
PopoverPopup.displayName = 'Popover.Popup';

function PopoverArrow({
  className,
  children = <ArrowSvg />,
  ...props
}: ComponentPropsWithoutRef<typeof PopoverBase.Arrow>) {
  return (
    <PopoverBase.Arrow
      data-slot="popover-arrow"
      className={(state) =>
        cn(
          'flex',
          'data-[side=bottom]:-top-2',
          'data-[side=left]:-right-3.25 data-[side=left]:rotate-90',
          'data-[side=right]:-left-3.25 data-[side=right]:-rotate-90',
          'data-[side=top]:-bottom-2 data-[side=top]:rotate-180',
          typeof className === 'function' ? className(state) : className,
        )
      }
      {...props}
    >
      {children}
    </PopoverBase.Arrow>
  );
}
PopoverArrow.displayName = 'Popover.Arrow';

function PopoverViewport(props: ComponentPropsWithoutRef<typeof PopoverBase.Viewport>) {
  return <PopoverBase.Viewport {...props} />;
}
PopoverViewport.displayName = 'Popover.Viewport';

type PopoverContentProps = {
  /** Position against this element instead of the trigger. */
  anchor?: ComponentPropsWithoutRef<typeof PopoverBase.Positioner>['anchor'];
  side?: PopoverSide;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  alignOffset?: number;
  positionMethod?: 'absolute' | 'fixed';
  className?: string;
  children?: ReactNode;
  container?: PortalContainer;
};

/** Portal + positioner + popup + arrow in one. */
function PopoverContent({
  children,
  side = 'bottom',
  align = 'center',
  sideOffset = 8,
  alignOffset = 0,
  positionMethod = 'absolute',
  anchor,
  className,
  container,
}: PopoverContentProps) {
  return (
    <PopoverPortal container={container}>
      <PopoverPositioner
        anchor={anchor}
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        positionMethod={positionMethod}
      >
        <PopoverBase.Popup
          data-slot="popover-popup"
          className={cn(
            POPUP_CLASSES,
            'transition-opacity duration-150',
            'data-ending-style:opacity-0 data-instant:duration-0 data-starting-style:opacity-0',
            className,
          )}
        >
          <PopoverArrow />
          {children}
        </PopoverBase.Popup>
      </PopoverPositioner>
    </PopoverPortal>
  );
}
PopoverContent.displayName = 'Popover.Content';

function PopoverTitle({ className, ...props }: ComponentPropsWithoutRef<typeof PopoverBase.Title>) {
  return (
    <PopoverBase.Title
      className={cn('m-0 text-base leading-6 font-medium', className)}
      {...props}
    />
  );
}
PopoverTitle.displayName = 'Popover.Title';

function PopoverDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof PopoverBase.Description>) {
  return (
    <PopoverBase.Description
      className={cn('m-0 text-base leading-6 text-muted-foreground', className)}
      {...props}
    />
  );
}
PopoverDescription.displayName = 'Popover.Description';

type PopoverCloseProps = ComponentPropsWithoutRef<typeof PopoverBase.Close> & { asChild?: boolean };

function PopoverClose({ children, className, asChild, render, ...props }: PopoverCloseProps) {
  const resolvedRender =
    render ?? (asChild ? (children as PopoverCloseProps['render']) : undefined);
  return (
    <PopoverBase.Close className={className} render={resolvedRender} {...props}>
      {asChild ? undefined : children}
    </PopoverBase.Close>
  );
}
PopoverClose.displayName = 'Popover.Close';

const Popover = Object.assign(PopoverRoot, {
  Root: PopoverRoot,
  Trigger: PopoverTrigger,
  Portal: PopoverPortal,
  Backdrop: PopoverBackdrop,
  Positioner: PopoverPositioner,
  Popup: PopoverPopup,
  Arrow: PopoverArrow,
  Viewport: PopoverViewport,
  Content: PopoverContent,
  Title: PopoverTitle,
  Description: PopoverDescription,
  Close: PopoverClose,
});

export type { PopoverContentProps, PopoverSide, PopoverTriggerProps };
export {
  Popover,
  PopoverArrow,
  PopoverBackdrop,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverPopup,
  PopoverPortal,
  PopoverPositioner,
  PopoverRoot,
  PopoverTitle,
  PopoverTrigger,
  PopoverViewport,
};
