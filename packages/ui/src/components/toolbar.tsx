'use client';

import { Toolbar as ToolbarBase } from '@base-ui/react/toolbar';
import * as React from 'react';

import { cn } from '../lib/utils';
import { Button as UIButton, type ButtonProps } from './button';
import { Input as UIInput } from './input';
import { InputGroup } from './input-group';
import { LinkButton as UILinkButton, type LinkButtonProps } from './link-button';

const SIZES = { xs: 'text-xs', sm: 'text-xs', base: 'text-base', lg: 'text-base' } as const;

/** @deprecated Kumo is removing toolbar size customisation: omit `size`. */
export type ToolbarSize = keyof typeof SIZES;

export interface ToolbarProps extends Omit<ToolbarBase.Root.Props, 'children'> {
  /** Toolbar controls, rendered as one grouped card. */
  children: React.ReactNode;
  /** @deprecated Omit to use the default size. */
  size?: ToolbarSize;
}

export type ToolbarButtonProps = Omit<ButtonProps, 'size' | 'variant'> &
  Pick<ToolbarBase.Button.Props, 'focusableWhenDisabled'>;
export type ToolbarLinkProps = Omit<LinkButtonProps, 'size' | 'variant'>;
export type ToolbarInputProps = Omit<React.ComponentProps<typeof UIInput>, 'size'> & {
  focusableWhenDisabled?: ToolbarBase.Input.Props['focusableWhenDisabled'];
};

export type ToolbarInputGroupProps = Omit<
  React.ComponentPropsWithoutRef<typeof InputGroup>,
  'size'
>;
type ToolbarInputGroupChildProps = React.ComponentPropsWithoutRef<typeof InputGroup.Input>;

const ToolbarSizeContext = React.createContext<{ size: ToolbarSize }>({ size: 'base' });

const CONTROL_STYLES = cn(
  'relative min-w-0 rounded-none border-0 bg-transparent shadow-none ring-0',
  'focus-within:z-2 focus:z-2 focus-visible:z-2 has-[:focus-visible]:z-2',
);

/** Groups toolbar controls into one compact card with roaming arrow-key focus. */
function Root({ children, className, size = 'base', ...props }: ToolbarProps) {
  return (
    <ToolbarBase.Root
      data-slot="toolbar"
      className={cn(
        'inline-flex w-fit max-w-full items-stretch rounded-lg bg-control shadow-xs ring ring-border',
        "[&>*:first-child]:rounded-l-lg [&>*:not([aria-hidden='true']):not([type='hidden']):not(:has(~_:not([aria-hidden='true']):not([type='hidden'])))]:rounded-r-lg",
        '[&>*_[data-toolbar-input]:focus]:rounded-[inherit]',
        "[&>*:not([aria-hidden='true']):not(:first-child)]:border-l [&>*:not([aria-hidden='true']):not(:first-child)]:border-border",
        SIZES[size],
        className as string | undefined,
      )}
      {...props}
    >
      <ToolbarSizeContext.Provider value={{ size }}>{children}</ToolbarSizeContext.Provider>
    </ToolbarBase.Root>
  );
}

function ToolbarButton({
  children,
  className,
  disabled,
  loading,
  shape,
  icon,
  type,
  ...props
}: ToolbarButtonProps) {
  const toolbar = React.useContext(ToolbarSizeContext);
  const resolvedShape = shape ?? (children == null && icon ? 'square' : 'base');
  return (
    <ToolbarBase.Button
      data-slot="toolbar-button"
      disabled={loading || disabled}
      className={cn(className as string | undefined, CONTROL_STYLES)}
      render={
        <UIButton
          shape={resolvedShape}
          icon={icon}
          loading={loading}
          size={toolbar.size}
          variant="ghost"
          type={type ?? 'button'}
        />
      }
      {...(props as object)}
    >
      {children}
    </ToolbarBase.Button>
  );
}

function ToolbarLink({ children, className, shape, icon, ...props }: ToolbarLinkProps) {
  const toolbar = React.useContext(ToolbarSizeContext);
  const resolvedShape = shape ?? (children == null && icon ? 'square' : 'base');
  return (
    <ToolbarBase.Link
      data-slot="toolbar-link"
      className={cn(className, CONTROL_STYLES)}
      render={
        <UILinkButton icon={icon} shape={resolvedShape} size={toolbar.size} variant="ghost" />
      }
      {...(props as object)}
    >
      {children}
    </ToolbarBase.Link>
  );
}

function ToolbarInput({ className, style, ...props }: ToolbarInputProps) {
  return (
    <ToolbarBase.Input
      data-slot="toolbar-input"
      render={<UIInput className={cn(className, CONTROL_STYLES)} style={style} />}
      {...(props as object)}
      data-toolbar-input=""
    />
  );
}

/** An InputGroup inside a toolbar: its Input joins the toolbar's arrow-key navigation. */
function ToolbarInputGroup({ children, className, ...props }: ToolbarInputGroupProps) {
  const toolbar = React.useContext(ToolbarSizeContext);
  const ariaLabel = props['aria-label'];
  const ariaLabelledBy = props['aria-labelledby'];

  const toolbarChildren = React.Children.map(children, (child) => {
    if (
      !React.isValidElement<ToolbarInputGroupChildProps>(child) ||
      (child.type as { displayName?: string })?.displayName !== 'InputGroup.Input'
    ) {
      return child;
    }
    return (
      <ToolbarBase.Input
        aria-label={child.props['aria-label'] ?? ariaLabel}
        aria-labelledby={child.props['aria-labelledby'] ?? ariaLabelledBy}
        render={React.cloneElement(child)}
      />
    );
  });

  return (
    <InputGroup className={cn(CONTROL_STYLES, className)} size={toolbar.size} {...props}>
      {toolbarChildren}
    </InputGroup>
  );
}

export const Toolbar = Object.assign(Root, {
  InputGroup: ToolbarInputGroup,
  Button: ToolbarButton,
  Link: ToolbarLink,
  Input: ToolbarInput,
});

export { ToolbarButton, ToolbarInput, ToolbarInputGroup, ToolbarLink };
