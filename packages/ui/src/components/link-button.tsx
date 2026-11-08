'use client';

import * as React from 'react';

import { cn } from '../lib/utils';
import {
  Button,
  buttonEmphasisStyle,
  buttonTextClasses,
  buttonVariants,
  renderButtonContent,
  renderButtonIcon,
  type ButtonShape,
  type ButtonSize,
  type ButtonVariant,
} from './button';
import type { Icon } from './icons';
import { useLinkComponent } from './ui-context';
import { Tooltip } from './tooltip';

export type LinkButtonProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  /** Icon (component or element) rendered before the children. */
  icon?: Icon | React.ReactNode;
  /** Opens in a new tab with `rel="noopener noreferrer"`. */
  external?: boolean;
  /** Renders a disabled <button> instead of a link. */
  disabled?: boolean;
  title?: React.ReactNode;
  ref?: React.Ref<HTMLAnchorElement>;
};

const ANCHOR_ONLY = new Set([
  'href',
  'target',
  'rel',
  'download',
  'hrefLang',
  'media',
  'ping',
  'referrerPolicy',
]);

/** An <a> (through the app's LinkProvider, so next/link) styled as a Button. */
export function LinkButton({
  children,
  className,
  disabled = false,
  external,
  href,
  shape = 'base',
  size = 'base',
  variant = 'ghost',
  icon,
  style,
  title,
  ref,
  ...props
}: LinkButtonProps) {
  const LinkComponent = useLinkComponent();

  if (disabled) {
    const rest = Object.fromEntries(
      Object.entries(props).filter(([k]) => !k.startsWith('on') && !ANCHOR_ONLY.has(k)),
    );
    return (
      <Button
        {...rest}
        className={cn('select-text', className)}
        disabled
        icon={icon}
        shape={shape}
        size={size}
        title={title}
        variant={variant}
      >
        {children}
      </Button>
    );
  }

  const iconNode = renderButtonIcon(icon);
  const emphasis = buttonEmphasisStyle(variant);
  const link = (
    <LinkComponent
      ref={ref}
      data-slot="link-button"
      className={cn(
        buttonVariants({ variant, size, shape }),
        buttonTextClasses(variant, size, shape, iconNode != null, children),
        'flex items-center no-underline! select-text',
        className,
      )}
      href={href}
      to={typeof href === 'string' ? href : undefined}
      style={emphasis ? { ...emphasis, ...style } : style}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...props}
    >
      {renderButtonContent(variant, iconNode, children)}
    </LinkComponent>
  );
  return title ? <Tooltip content={title}>{link}</Tooltip> : link;
}
