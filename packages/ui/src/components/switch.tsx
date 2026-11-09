'use client';

/**
 * Switch — an on/off toggle. the `switch` pattern on Base UI Switch.
 *
 * Compound component: `<Switch>` (pass `label` for a built-in Field), `Switch.Group` (a fieldset
 * of switches with a legend, description and error), `Switch.Item`, `Switch.Legend`.
 * Squircle track and thumb in 3 sizes; `variant="default"` is the brand colour, `neutral` is
 * monochrome for quiet toggles.
 *
 * @example
 * <Switch label="Email receipts" checked={on} onCheckedChange={setOn} />
 *
 * <Switch.Group legend="Notify me about">
 *   <Switch.Item label="New orders" />
 *   <Switch.Item label="Returns" />
 * </Switch.Group>
 */
import { Fieldset } from '@base-ui/react/fieldset';
import { Switch as BaseSwitch } from '@base-ui/react/switch';
import {
  createContext,
  forwardRef,
  useContext,
  type ButtonHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';

import { cn } from '../lib/utils';
import { Field } from './label';

type SwitchRender = BaseSwitch.Root.Props['render'];
type SwitchSize = 'sm' | 'base' | 'lg';
type SwitchVariant = 'default' | 'neutral';

const SIZES: Record<SwitchSize, { track: string; thumb: string; slide: string }> = {
  sm: { track: 'h-4 w-8', thumb: 'w-4', slide: 'left-4' },
  base: { track: 'h-4.5 w-9', thumb: 'w-4.5', slide: 'left-4.5' },
  lg: { track: 'h-5 w-10', thumb: 'w-5', slide: 'left-5' },
};

const SQUIRCLE =
  'rounded-[5px] supports-[corner-shape:squircle]:rounded-[10px] [corner-shape:squircle]';

/** The classes of the switch track, for building your own toggle. */
function switchVariants({
  size = 'base',
  variant = 'default',
  checked = false,
}: { size?: SwitchSize; variant?: SwitchVariant; checked?: boolean } = {}) {
  const track =
    variant === 'neutral'
      ? checked
        ? 'bg-contrast ring-contrast'
        : 'bg-fill ring-border'
      : checked
        ? 'bg-primary ring-primary'
        : 'bg-fill ring-border';
  return cn(
    'relative inline-flex shrink-0 cursor-pointer items-center border-none p-0 ring',
    'transition-colors duration-150 ease-out motion-reduce:transition-none',
    'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
    'disabled:cursor-not-allowed disabled:opacity-50',
    SIZES[size].track,
    SQUIRCLE,
    track,
  );
}

type SwitchBaseProps = {
  variant?: SwitchVariant;
  size?: SwitchSize;
  checked?: boolean;
  /** Start on, when you don't control it with `checked`. */
  defaultChecked?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Request in flight: tells screen readers the switch is busy. */
  transitioning?: boolean;
};

type SwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> &
  SwitchBaseProps & {
    /** Visible label (wraps the switch in a Field). */
    label?: ReactNode;
    labelTooltip?: ReactNode;
    /** `false` adds "(optional)" to the label. */
    required?: boolean;
    /** Switch before the label (default) or after it. */
    controlFirst?: boolean;
  };

/** The Base UI switch drawn as a track + thumb. */
function renderSwitch(
  {
    size = 'base',
    variant = 'default',
    transitioning,
    className,
    props,
  }: {
    size?: SwitchSize;
    variant?: SwitchVariant;
    transitioning?: boolean;
    className?: string;
    props?: ButtonHTMLAttributes<HTMLButtonElement>;
  },
  part?: string,
) {
  return (rootProps: Record<string, unknown>, state: { checked: boolean }) => {
    const {
      ref: rootRef,
      className: baseClassName,
      role: baseRole,
      'aria-checked': _ariaChecked,
      'aria-pressed': _ariaPressed,
      ...restRootProps
    } = rootProps as {
      ref?: Ref<HTMLButtonElement>;
      className?: string;
      role?: string;
      'aria-checked'?: boolean;
      'aria-pressed'?: boolean;
      [key: string]: unknown;
    };
    const s = SIZES[size];
    const role = props?.role ?? baseRole ?? 'switch';
    const checkedA11y =
      role === 'switch' ? { 'aria-checked': state.checked } : { 'aria-pressed': state.checked };
    return (
      <button
        {...restRootProps}
        {...props}
        ref={rootRef}
        data-slot={part ?? 'switch'}
        type="button"
        role={role}
        {...checkedA11y}
        aria-busy={transitioning || undefined}
        className={cn(
          switchVariants({ size, variant, checked: state.checked }),
          className,
          baseClassName,
        )}
      >
        <div
          className={cn(
            'absolute top-0 bottom-0 bg-card shadow-sm',
            'transition-all duration-150 ease-out motion-reduce:transition-none',
            s.thumb,
            SQUIRCLE,
            state.checked ? s.slide : 'left-0',
          )}
        />
      </button>
    );
  };
}

const SwitchRoot = forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      className,
      checked,
      defaultChecked,
      disabled,
      size = 'base',
      variant = 'default',
      label,
      labelTooltip,
      required,
      controlFirst = true,
      onCheckedChange,
      transitioning,
      id,
      ...props
    },
    ref,
  ) => {
    const control = (
      <BaseSwitch.Root
        ref={ref}
        id={id}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        nativeButton
        render={
          renderSwitch({
            size,
            variant,
            transitioning,
            className,
            props,
          }) as unknown as SwitchRender
        }
      />
    );
    if (!label) return control;
    return (
      <Field
        label={label}
        required={required}
        labelTooltip={labelTooltip}
        controlFirst={controlFirst}
      >
        {control}
      </Field>
    );
  },
);
SwitchRoot.displayName = 'Switch';

const SwitchGroupContext = createContext<{ controlFirst: boolean }>({ controlFirst: true });

type SwitchItemProps = SwitchBaseProps & {
  label: string;
  className?: string;
};

/** One labelled switch inside `Switch.Group`. */
const SwitchItem = forwardRef<HTMLButtonElement, SwitchItemProps>(
  (
    {
      className,
      checked,
      defaultChecked,
      disabled,
      size = 'base',
      variant = 'default',
      label,
      onCheckedChange,
      transitioning,
    },
    ref,
  ) => {
    const { controlFirst } = useContext(SwitchGroupContext);
    return (
      <label
        data-slot="switch-item"
        className={cn(
          'relative m-0 inline-flex items-center gap-2',
          !controlFirst && 'flex-row-reverse justify-end',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          className,
        )}
      >
        <BaseSwitch.Root
          ref={ref}
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
          nativeButton
          render={
            renderSwitch(
              { size, variant, transitioning },
              'switch-item-control',
            ) as unknown as SwitchRender
          }
        />
        <span className="text-base font-medium text-foreground">{label}</span>
      </label>
    );
  },
);
SwitchItem.displayName = 'Switch.Item';

function SwitchLegend({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Fieldset.Legend className={cn('text-base font-medium text-foreground', className)}>
      {children}
    </Fieldset.Legend>
  );
}
SwitchLegend.displayName = 'Switch.Legend';

function SwitchGroup({
  legend,
  children,
  error,
  description,
  disabled,
  controlFirst = true,
  className,
}: {
  legend?: string;
  children: ReactNode;
  error?: string;
  description?: ReactNode;
  disabled?: boolean;
  controlFirst?: boolean;
  className?: string;
}) {
  return (
    <SwitchGroupContext.Provider value={{ controlFirst }}>
      <Fieldset.Root className={cn('flex flex-col gap-4', className)} disabled={disabled}>
        {legend && (
          <Fieldset.Legend className="text-base font-medium text-foreground">
            {legend}
          </Fieldset.Legend>
        )}
        <div className="flex flex-col gap-2">{children}</div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </Fieldset.Root>
    </SwitchGroupContext.Provider>
  );
}
SwitchGroup.displayName = 'Switch.Group';

const Switch = Object.assign(SwitchRoot, {
  Item: SwitchItem,
  Group: SwitchGroup,
  Legend: SwitchLegend,
});
Switch.displayName = 'Switch';

export { Switch, switchVariants };
export type { SwitchItemProps, SwitchProps, SwitchSize, SwitchVariant };
