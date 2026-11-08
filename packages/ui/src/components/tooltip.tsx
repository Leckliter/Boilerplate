'use client';

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import {
  isValidElement,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from 'react';

import { cn } from '../lib/utils';
import { usePortalContainer, type PortalContainer } from './kumo-context';

/* Cloudflare Kumo's Tooltip (MIT): a card with an outline and an arrow, scales in. */

const TooltipProvider = TooltipPrimitive.Provider;

type TriggerProps = ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>;
type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

type TooltipProps = ComponentPropsWithoutRef<typeof TooltipPrimitive.Root> & {
  /** What the tooltip says. */
  content: ReactNode;
  /**
   * The thing to hover. An element (`<Button …/>`) becomes the trigger itself;
   * text or several nodes are wrapped in an inline trigger.
   */
  children: ReactNode;
  side?: TooltipSide;
  align?: 'start' | 'center' | 'end';
  className?: string;
  container?: PortalContainer;
  /** Milliseconds before it opens / closes. */
  delay?: number;
  closeDelay?: number;
  /** Render the trigger as this element instead (Base UI `render`). */
  render?: TriggerProps['render'];
};

/** Simple tooltip: <Tooltip content="Archive"><Button …/></Tooltip> */
function Tooltip({
  content,
  children,
  side = 'top',
  align,
  className,
  container: containerProp,
  delay,
  closeDelay,
  render,
  ...props
}: TooltipProps) {
  const contextContainer = usePortalContainer();
  const container = containerProp ?? contextContainer ?? undefined;
  const asElement = render ?? (isValidElement(children) ? (children as ReactElement) : undefined);
  const triggerTabIndex = !asElement && props.disabled ? -1 : undefined;

  return (
    <TooltipPrimitive.Root {...props}>
      <TooltipPrimitive.Trigger
        delay={delay}
        closeDelay={closeDelay}
        className={
          asElement
            ? undefined
            : 'm-0 inline-flex cursor-default items-center border-none bg-transparent p-0 shadow-none'
        }
        render={asElement}
        tabIndex={triggerTabIndex}
      >
        {render || isValidElement(children) ? undefined : children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal container={container}>
        <TooltipPrimitive.Positioner
          side={side}
          align={align}
          sideOffset={10}
          className="z-100 max-w-(--available-width)"
        >
          <TooltipPrimitive.Popup
            data-slot="tooltip"
            className={cn(
              'flex origin-(--transform-origin) flex-col rounded-md bg-card px-2.5 py-1.5 text-sm text-foreground shadow-md outline outline-border',
              'transition-[transform,scale,opacity] duration-150',
              'data-starting-style:scale-90 data-starting-style:opacity-0',
              'data-ending-style:scale-90 data-ending-style:opacity-0',
              'data-instant:duration-0',
              className,
            )}
          >
            <TooltipPrimitive.Arrow
              className={cn(
                'flex',
                'data-[side=bottom]:-top-2',
                'data-[side=left]:-right-3.25 data-[side=left]:rotate-90',
                'data-[side=right]:-left-3.25 data-[side=right]:-rotate-90',
                'data-[side=top]:-bottom-2 data-[side=top]:rotate-180',
              )}
            >
              <ArrowSvg />
            </TooltipPrimitive.Arrow>
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/** The little pointer on a tooltip or popover; the fills are the card colour and its outline. */
function ArrowSvg(props: React.ComponentProps<'svg'>) {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden {...props}>
      <path
        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
        className="fill-card"
      />
      <path
        d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
        className="fill-arrow-edge"
      />
      <path
        d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
        className="fill-arrow-stroke"
      />
    </svg>
  );
}

export type { TooltipProps };
export { ArrowSvg, Tooltip, TooltipProvider };
