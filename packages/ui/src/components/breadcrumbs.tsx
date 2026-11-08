'use client';

import {
  Children,
  cloneElement,
  isValidElement,
  type PropsWithChildren,
  type ReactElement,
  type ReactNode,
} from 'react';

import { useCopyFeedback } from '../lib/use-copy-feedback';
import { cn } from '../lib/utils';
import { Button } from './button';
import { CheckIcon, CopyIcon } from './icons';
import { useLinkComponent } from './ui-context';

const SIZES = {
  sm: 'h-10 gap-0.5 text-sm',
  base: 'h-12 gap-1 text-base',
} as const;

export type BreadcrumbsSize = keyof typeof SIZES;

export function breadcrumbsVariants({ size = 'base' }: { size?: BreadcrumbsSize } = {}) {
  return cn(
    'group mr-4 flex min-w-0 grow items-center overflow-hidden whitespace-nowrap',
    SIZES[size],
  );
}

export interface BreadcrumbsItemProps {
  href: string;
  icon?: ReactNode;
}

function Link({ href, icon, children }: PropsWithChildren<BreadcrumbsItemProps>) {
  const LinkComponent = useLinkComponent();
  return (
    <LinkComponent
      data-slot="breadcrumbs-link"
      to={href}
      // Ancestors do not shrink: only the current page may give up width.
      className="flex shrink-0 items-center gap-1 whitespace-nowrap text-muted-foreground no-underline hover:text-foreground"
    >
      {!!icon && <span className="flex shrink-0 items-center">{icon}</span>}
      <span>{children}</span>
    </LinkComponent>
  );
}

function Current({
  children,
  icon,
  loading,
}: PropsWithChildren<{ loading?: boolean; icon?: ReactNode }>) {
  if (loading) {
    return (
      <div className="flex w-[125px] min-w-0 items-center gap-1">
        {icon && <span className="flex shrink-0 items-center">{icon}</span>}
        <span className="h-3 w-full animate-pulse rounded-full bg-fill" aria-hidden />
      </div>
    );
  }
  return (
    <div className="flex max-w-full min-w-0 items-center gap-1 font-medium" aria-current="page">
      {icon && <span className="flex shrink-0 items-center">{icon}</span>}
      <span className="truncate">{children}</span>
    </div>
  );
}

function Separator() {
  return (
    <span className="flex shrink-0 items-center text-inactive" aria-hidden="true">
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M10.75 8.75L14.25 12L10.75 15.25"
        />
      </svg>
    </span>
  );
}

function MobileEllipsis() {
  return (
    <span className="flex shrink-0 items-center text-muted-foreground" aria-hidden>
      ...
    </span>
  );
}

/** A copy-the-link button that shows when the trail is hovered. */
function Clipboard({ text }: { text: string }) {
  const { copied, runCopy } = useCopyFeedback();
  return (
    <Button
      variant="ghost"
      shape="square"
      size="sm"
      className="opacity-0 transition-[opacity] group-hover:opacity-100 focus-visible:opacity-100"
      onClick={async () => {
        if (!text) return;
        await runCopy(
          () => navigator.clipboard.writeText(text),
          // Not worth an error reference: the button just doesn't show the tick.
          () => undefined,
        );
      }}
      title="Click to copy"
      aria-label="Copy"
    >
      {copied ? <CheckIcon weight="bold" className="text-success" /> : <CopyIcon />}
    </Button>
  );
}

export interface BreadcrumbsProps extends PropsWithChildren {
  size?: BreadcrumbsSize;
  className?: string;
}

function isComponentElement(child: ReactNode, component: unknown): child is ReactElement {
  return isValidElement(child) && child.type === component;
}

/** On a phone: "… › parent › current". */
function getMobileChildren(children: ReactNode[]): ReactNode[] {
  const items = children.filter(
    (child) => isComponentElement(child, Link) || isComponentElement(child, Current),
  ) as ReactElement[];
  if (items.length <= 2) return children;

  const [parent, current] = items.slice(-2);
  if (!parent || !current) return children;
  const trailing: ReactNode[] = [
    <MobileEllipsis key="mobile-ellipsis" />,
    <Separator key="mobile-separator-leading" />,
    cloneElement(parent, { key: 'mobile-parent' }),
    <Separator key="mobile-separator-trailing" />,
    cloneElement(current, { key: 'mobile-current' }),
  ];
  const extras = children.filter(
    (child) =>
      !isComponentElement(child, Link) &&
      !isComponentElement(child, Current) &&
      !isComponentElement(child, Separator),
  );
  return [...trailing, ...extras];
}

/**
 * Breadcrumb trail. Compound: `Breadcrumbs.Link`, `.Current`, `.Separator`, `.Clipboard`.
 * ```tsx
 * <Breadcrumbs>
 *   <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
 *   <Breadcrumbs.Separator />
 *   <Breadcrumbs.Current>Dashboard</Breadcrumbs.Current>
 * </Breadcrumbs>
 * ```
 */
function BreadcrumbsRoot({ children, size = 'base', className }: BreadcrumbsProps) {
  const childArray = Children.toArray(children);
  return (
    <nav className={cn(breadcrumbsVariants({ size }), className)} aria-label="breadcrumb">
      <div className="contents sm:hidden">{getMobileChildren(childArray)}</div>
      <div className="hidden sm:contents">{childArray}</div>
    </nav>
  );
}

export const Breadcrumbs = Object.assign(BreadcrumbsRoot, { Link, Current, Separator, Clipboard });
/** The parts by their own names, for importing from a server component (dotting into a client module fails there). */
export {
  Link as BreadcrumbsLink,
  Current as BreadcrumbsCurrent,
  Separator as BreadcrumbsSeparator,
  Clipboard as BreadcrumbsClipboard,
};
