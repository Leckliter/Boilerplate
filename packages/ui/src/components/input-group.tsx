'use client';

/**
 * InputGroup: an input with icons, text addons, an inline suffix and action buttons in one
 * box. the `input-group` pattern: `InputGroup`, `InputGroup.Input`, `.Addon`,
 * `.Suffix`, `.Button`. Size, disabled and error come from the group. Pass `label` /
 * `description` / `error` to wrap it in a field.
 *
 * @example
 * <InputGroup label="Email">
 *   <InputGroup.Addon><EnvelopeIcon /></InputGroup.Addon>
 *   <InputGroup.Input type="email" placeholder="you@example.com" />
 * </InputGroup>
 * <InputGroup aria-label="Subdomain">
 *   <InputGroup.Input placeholder="my-shop" />
 *   <InputGroup.Suffix>.rentsomethingkc.com</InputGroup.Suffix>
 * </InputGroup>
 */
import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useContext,
  useId,
  useMemo,
  type ComponentPropsWithoutRef,
  type PropsWithChildren,
  type ReactElement,
  type ReactNode,
} from 'react';

import { cn } from '../lib/utils';
import { Button as ButtonExternal, type ButtonProps } from './button';
import { Input as InputExternal, inputVariants, type InputProps, type InputSize } from './input';
import {
  INPUT_GROUP_HAS_CLASSES,
  INPUT_GROUP_SIZE,
  InputGroupAddonContext,
  InputGroupContext,
  detectFocusMode,
  partitionChildren,
  useInputGroupContext,
  type InputGroupRootPropsInternal,
} from './input-group-context';
import { Field } from './label';
import { Tooltip } from './tooltip';

type UiInputSize = InputSize;

// ── Addon

export interface InputGroupAddonProps {
  /** Position relative to the input. @default "start" */
  align?: 'start' | 'end';
  /** Additional CSS classes. */
  className?: string;
  /** Addon content: icons, buttons, spinners, text. */
  children?: ReactNode;
}

/**
 * Container for icons, text, or compact buttons positioned at the start or end
 * of the input. Automatically sizes icon children to match the input size.
 */
export const Addon = forwardRef<HTMLDivElement, InputGroupAddonProps>(
  ({ align = 'start', className, children }, ref) => {
    const context = useInputGroupContext('Addon');

    const size = context?.size ?? 'base';
    const tokens = INPUT_GROUP_SIZE[size];

    // Inject size into direct icon children that don't already have one set.
    // Skips buttons (which have their own size handling) and non-element nodes.
    // Also tracks whether a Button is present so we can reduce outer padding.
    let containsButton = false;
    const sizedChildren = Children.map(children, (child) => {
      if (!isValidElement(child)) return child;
      if (child.type === Button) {
        containsButton = true;
        return child;
      }
      const props = child.props as { size?: unknown };
      if (props.size !== undefined) return child;
      return cloneElement(child as ReactElement<{ size?: number }>, {
        size: tokens.iconSize,
      });
    });

    // Always use flex-based positioning. CSS order controls visual placement.
    return (
      <div
        ref={ref}
        data-slot={align === 'start' ? 'input-group-addon-start' : 'input-group-addon-end'}
        className={cn(
          'pointer-events-none relative z-[1] flex shrink-0 items-center gap-1.5',
          'text-muted-foreground',
          tokens.fontSize,
          '*:pointer-events-auto',
          align === 'start'
            ? cn(
                '-order-1',
                containsButton ? tokens.addonButtonOuterStart : tokens.addonOuterStart,
                'pr-0',
              )
            : cn(
                'order-1',
                'pl-0',
                containsButton ? tokens.addonButtonOuterEnd : tokens.addonOuterEnd,
              ),
          className,
        )}
      >
        <InputGroupAddonContext.Provider value={true}>
          {sizedChildren}
        </InputGroupAddonContext.Provider>
      </div>
    );
  },
);
Addon.displayName = 'InputGroup.Addon';

// ── Input

/** Props for InputGroup.Input — omits Field props since InputGroup handles them. */
export type InputGroupInputProps = Omit<
  InputProps,
  'label' | 'labelTooltip' | 'description' | 'error' | 'size' | 'disabled'
>;

/**
 * Text input that inherits size, disabled, and error state from InputGroup context.
 * Automatically sets `aria-invalid` when parent has an error.
 */
export const Input = forwardRef<HTMLInputElement, InputGroupInputProps>((props, ref) => {
  const context = useInputGroupContext('Input');

  // Warn when props that belong on <InputGroup> are passed directly
  const misplaced = props as Record<string, unknown>;
  if (process.env.NODE_ENV !== 'production' && context) {
    if (misplaced.size !== undefined) {
      console.warn('InputGroup.Input: Set `size` on <InputGroup> instead of <InputGroup.Input>.');
    }
    if (misplaced.disabled !== undefined) {
      console.warn(
        'InputGroup.Input: Set `disabled` on <InputGroup> instead of <InputGroup.Input>.',
      );
    }
    if (misplaced.label !== undefined) {
      console.warn(
        'InputGroup.Input: Use the `label` prop on <InputGroup> instead of <InputGroup.Input>.',
      );
    }
    if (misplaced.description !== undefined) {
      console.warn(
        'InputGroup.Input: Use <InputGroup.Suffix> instead of passing `description` to <InputGroup.Input>.',
      );
    }
  }

  const size = context?.size ?? 'base';
  const tokens = INPUT_GROUP_SIZE[size];
  const isIndividual = context?.focusMode === 'individual';

  // Auto-set aria-invalid when error is present in context
  const hasError = Boolean(context?.error);

  // Use explicit id if provided, otherwise fall back to context id
  // (links the input to the invisible label overlay for click-to-focus).
  const inputId = props.id ?? context?.inputId;

  return (
    <InputExternal
      ref={ref}
      size={context?.size}
      disabled={context?.disabled || Boolean(misplaced.disabled)}
      aria-invalid={hasError || props['aria-invalid']}
      {...props}
      id={inputId}
      className={cn(
        // Base input layout: fill height, allow shrinking, strip native border/radius
        'flex h-full min-w-0 grow items-center rounded-none border-0 bg-transparent font-sans',
        // Always use full outer padding — the container's has-[] rules reduce pl/pr to inputSeam on sides that touch an addon.
        tokens.inputOuter,
        // Truncate overflowing text with "…" instead of expanding the input
        'text-ellipsis',
        // Individual mode: each element owns its own border instead of sharing a container ring
        isIndividual
          ? [
              // Own border replaces the container's shared ring; suppress the base Input's focus:ring so only the border-swap shows
              'relative border border-border ring-0 focus:ring-0',
              'first:rounded-l-[inherit] last:rounded-r-[inherit]',
              // Negative margin (not border-l-0) so the border is still paintable on focus
              'not-first:-ml-px',
              'hover:z-1 hover:border-border',
              // z-[2] lifts above hovered siblings so focus border isn't clipped
              'focus:z-2 focus:border-ring/50',
            ].join(' ')
          : // Container mode: kill all focus indicators — the container handles them z-1 lifts the input above the invisible label overlay so cursor/selection work
            'relative z-1 shadow-none ring-0! outline-none focus:ring-0! focus:outline-none',
        props.className,
      )}
    />
  );
});
Input.displayName = 'InputGroup.Input';

// ── Suffix

export interface InputGroupSuffixProps {
  /** Additional CSS classes. */
  className?: string;
  /** Suffix content (e.g., ".workers.dev"). */
  children?: ReactNode;
}

/**
 * Inline suffix that flows seamlessly next to the typed input value.
 * Input width adjusts automatically via CSS `field-sizing: content`.
 */
export const Suffix = forwardRef<HTMLDivElement, InputGroupSuffixProps>(
  ({ className, children }, ref) => {
    const context = useInputGroupContext('Suffix');

    const size = context?.size ?? 'base';
    const tokens = INPUT_GROUP_SIZE[size];

    return (
      <div
        ref={ref}
        data-slot="input-group-suffix"
        className={cn(
          'pointer-events-none flex min-w-0 grow items-center text-muted-foreground select-none',
          tokens.fontSize,
          tokens.suffixPad,
          className,
        )}
      >
        <span className="truncate">{children}</span>
      </div>
    );
  },
);
Suffix.displayName = 'InputGroup.Suffix';

// ── Button
const COMPACT_BUTTON: Record<UiInputSize, string> = {
  xs: 'h-4 gap-1 rounded-sm px-1 text-xs',
  sm: 'h-5 gap-1 rounded px-1.5 text-xs',
  base: 'h-6.5 gap-1 rounded-md px-2 text-sm',
  lg: 'h-8 gap-1.5 rounded-md px-2.5 text-base',
};

export type InputGroupButtonProps = ButtonProps & {
  /** Tooltip text (also the accessible name of an icon-only button). */
  tooltip?: ReactNode;
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
};

/**
 * Action button inside the group. A ghost button belongs in an `InputGroup.Addon`; a
 * non-ghost one sits beside the input with its own border. Its size follows the group.
 */
export const Button = forwardRef<HTMLButtonElement, PropsWithChildren<InputGroupButtonProps>>(
  ({ children, className, variant, disabled, tooltip, tooltipSide = 'bottom', ...props }, ref) => {
    const context = useInputGroupContext('Button');
    const isInsideAddon = useContext(InputGroupAddonContext);
    const isDisabled = disabled ?? context?.disabled;
    const isIndividual = context?.focusMode === 'individual' || context?.focusMode === 'hybrid';
    const effectiveVariant = variant ?? 'ghost';

    if (
      process.env.NODE_ENV !== 'production' &&
      context &&
      effectiveVariant === 'ghost' &&
      !isInsideAddon
    ) {
      console.warn(
        'InputGroup.Button: Ghost buttons should be wrapped in <InputGroup.Addon> for correct spacing.',
      );
    }

    // Icon-only buttons need a name: take it from the tooltip text.
    const tooltipAriaLabel =
      typeof tooltip === 'string' && !props['aria-label'] ? tooltip : undefined;

    const btn = (
      <ButtonExternal
        ref={ref}
        type="button"
        disabled={isDisabled}
        aria-label={tooltipAriaLabel}
        {...props}
        variant={effectiveVariant}
        className={cn(
          // Clicks register even when the parent has pointer-events-none (disabled overlay).
          'pointer-events-auto shadow-none focus:ring-0',
          // Inside the box: one size down so the button stays subordinate to the input.
          !isIndividual && [
            COMPACT_BUTTON[context?.size ?? 'base'],
            'focus-visible:ring-[1.5px] focus-visible:ring-ring',
          ],
          // Beside the input: own border and focus indicator, full height.
          isIndividual && [
            'relative h-full! rounded-none border border-border px-3 ring-0 focus-visible:ring-0',
            'first:rounded-l-[inherit] last:rounded-r-[inherit]',
            'not-first:-ml-px hover:z-1 focus:z-2 focus-visible:border-ring',
            'disabled:bg-overlay disabled:text-inactive!',
          ],
          className,
        )}
      >
        {children}
      </ButtonExternal>
    );

    if (tooltip) {
      return (
        <Tooltip content={tooltip} side={tooltipSide}>
          {btn}
        </Tooltip>
      );
    }
    return btn;
  },
);
Button.displayName = 'InputGroup.Button';

// ── Root
/**
 * Compound input component for building inputs with icons, addons, inline
 * suffixes, and action buttons. Accepts Field props and wraps content in
 * Field when label is provided.
 *
 * Renders as `<label>` only in standalone container mode (single input, no
 * sibling buttons) so clicking empty space focuses the input. Otherwise
 * renders as `<div>` to avoid nested `<label>` (when Field provides one) or
 * the browser's `:hover` propagation from `<label>` to its first labelable
 * descendant (when multiple labelable controls are siblings).
 *
 * @note Do not wrap InputGroup inside an external Field without using the `label` prop —
 * this creates invalid nested `<label>` elements. Use InputGroup's own `label` prop instead.
 *
 * @example
 * ```tsx
 * <InputGroup label="Email" error={{ message: "Invalid", match: true }}>
 *   <InputGroup.Addon><EnvelopeIcon /></InputGroup.Addon>
 *   <InputGroup.Input placeholder="you@example.com" />
 * </InputGroup>
 * ```
 *
 * @example
 * ```tsx
 * <InputGroup>
 *   <InputGroup.Input placeholder="my-worker" />
 *   <InputGroup.Suffix>.workers.dev</InputGroup.Suffix>
 * </InputGroup>
 * ```
 */
const Root = forwardRef<HTMLElement, PropsWithChildren<InputGroupRootPropsInternal>>(
  (
    {
      size = 'base',
      children,
      className,
      disabled = false,
      label,
      description,
      error,
      required,
      labelTooltip,
      ...rest
    },
    forwardedRef,
  ) => {
    const inputId = useId();
    const focusMode = detectFocusMode(children);

    const contextValue = useMemo(
      () => ({
        size,
        focusMode,
        disabled,
        error,
        inputId,
      }),
      [size, focusMode, disabled, error, inputId],
    );

    // When label is provided, Field already renders a <label> with htmlFor
    // that handles click-to-focus. Using <div> avoids nested <label> elements
    // (invalid HTML with undefined assistive technology behavior).
    // When standalone (no label), a native <label> preserves click-to-focus.
    const containerClassName = cn(
      // Establish positioning context and make the whole area a click target
      'relative w-full cursor-text',
      // inputVariants provides base ring-border; must come before state overrides
      inputVariants({ size }),
      // Disabled state: prevent interaction and dim the entire group
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      // Container mode: clip children to rounded corners and show a shared focus ring
      // Individual mode: disable container ring/shadow so each child owns its own border
      focusMode === 'container'
        ? [
            'overflow-hidden',
            // Focus state must come AFTER inputVariants to override ring-border
            'focus-within:ring-[1.5px] focus-within:ring-ring/50 has-focus-visible:outline-hidden',
          ]
        : // isolate creates a new stacking context so z-index in children doesn't leak out
          'isolate overflow-visible shadow-none ring-0',
      // Error state must also come after inputVariants
      'has-[input[aria-invalid=true]]:ring-destructive',
      // Reset horizontal padding — children handle their own spacing
      'px-0',
      // Horizontal layout with no gap — children control their own internal spacing
      'flex items-center gap-0',
      // When a suffix is present, let the input shrink to its content width
      // so the suffix stays visually adjacent
      'has-[[data-slot=input-group-suffix]]:[&_input]:[field-sizing:content]',
      'has-[[data-slot=input-group-suffix]]:[&_input]:max-w-full',
      'has-[[data-slot=input-group-suffix]]:[&_input]:grow-0',
      'has-[[data-slot=input-group-suffix]]:[&_input]:pr-0',
      // Size-specific padding adjustments when addons or suffixes are present
      INPUT_GROUP_HAS_CLASSES[size],
      // Reset bottom margin to avoid inherited spacing from parent <label> styles
      '!mb-0',
      className,
    );

    // Data attributes drive CSS selectors in the input-group styles (focus outline)
    // and enable child components to query their parent's state.
    const dataProps = {
      'data-slot': 'input-group' as const,
      'data-focus-mode': focusMode,
      'data-disabled': disabled ? ('' as const) : undefined,
    };

    // Hybrid mode: splits children into two rendering zones:
    // 1. Container zone (Addon + Input + Suffix) — shares a single border/ring
    // 2. Individual zone (standalone Buttons) — each button owns its own border
    // This lets inputs and addons look unified while buttons remain independent.
    if (focusMode === 'hybrid') {
      // Partition children by type: addons/inputs/suffixes → container, buttons → individual
      const { containerZone, individualZone } = partitionChildren(children);

      // Override focusMode to "container" for children inside the zone
      // so InputGroup.Input uses container-mode styling (ring-0!, no own border).
      const containerZoneContext = {
        ...contextValue,
        focusMode: 'container' as const,
      };

      const hybridContent = (
        <>
          {/* Container zone wrapper — shares a single border/ring */}
          <InputGroupContext.Provider value={containerZoneContext}>
            <div
              data-slot="input-group-container-zone"
              className={cn(
                // Base input sizing/shape from shared variant function
                inputVariants({ size }),
                // Clip children to rounded corners within the zone
                'overflow-hidden',
                // Show red ring on validation error
                'has-[input[aria-invalid=true]]:ring-destructive',
                // Reset horizontal padding — children handle their own spacing
                'px-0',
                // Fill available width but allow shrinking when sibling buttons are present
                'flex min-w-0 flex-1 items-center gap-0',
                // Use a clean 1px CSS border instead of ring+shadow from inputVariants
                // so the zone matches adjacent individual-mode buttons exactly.
                'shadow-none ring-0',
                'border border-border',
                'focus-within:border-ring/50 has-focus-visible:outline-hidden',
                // z-[2] lifts above adjacent button's -ml-px overlap so focus border shows
                'focus-within:z-2',
                // Negative margin (not border-l-0) so the border is still paintable on focus
                'not-first:-ml-px',
                // Outer edges inherit radius; inner edges are flat against sibling buttons
                'rounded-none first:rounded-l-[inherit] last:rounded-r-[inherit]',
                // Size-specific padding adjustments when addons or suffixes are present
                INPUT_GROUP_HAS_CLASSES[size],
                // When a suffix is present, let the input shrink to its content width
                'has-data-[slot=input-group-suffix]:[&_input]:field-sizing-content',
                'has-data-[slot=input-group-suffix]:[&_input]:max-w-full',
                'has-data-[slot=input-group-suffix]:[&_input]:grow-0',
                'has-data-[slot=input-group-suffix]:[&_input]:pr-0',
              )}
            >
              {/* When label exists, an invisible <label> overlay enables click-to-focus inside the container zone without nesting visible <label> elements */}
              {label && (
                // Invisible overlay for click-to-focus; the visible Field label handles a11y
                <label
                  htmlFor={inputId}
                  // Positioned behind children (z-0) so it catches clicks on empty space
                  className="absolute inset-0 z-0 mb-0! cursor-text"
                  aria-hidden="true"
                />
              )}
              {containerZone}
            </div>
          </InputGroupContext.Provider>
          {/* Individual zone — buttons with their own borders */}
          {individualZone}
        </>
      );

      // Hybrid always uses a <div> container (never <label>) because individual-zone buttons are siblings — wrapping them in a <label> would be semantically incorrect.
      const hybridContainer = (
        <InputGroupContext.Provider value={contextValue}>
          <div
            ref={forwardedRef as React.Ref<HTMLDivElement>}
            {...dataProps}
            className={containerClassName}
            {...rest}
          >
            {hybridContent}
          </div>
        </InputGroupContext.Provider>
      );

      if (label) {
        return (
          <Field
            label={label}
            description={description}
            error={error}
            required={required}
            labelTooltip={labelTooltip}
          >
            {hybridContainer}
          </Field>
        );
      }

      return hybridContainer;
    }

    // Container / Individual mode (non-hybrid)
    // Use <label> only when there's exactly one labelable descendant; otherwise <label> would propagate :hover to its first labelable descendant.
    const useLabelContainer = !label && focusMode === 'container';
    const container = (
      <InputGroupContext.Provider value={contextValue}>
        {/* When label is set, use <div> to avoid nested <label> (Field provides one). An invisible <label> overlay handles click-to-focus on empty space. */}
        {label ? (
          <div
            ref={forwardedRef as React.Ref<HTMLDivElement>}
            {...dataProps}
            className={containerClassName}
            {...rest}
          >
            <label
              htmlFor={inputId}
              // Positioned behind children (z-0) so it catches clicks on empty space
              className="absolute inset-0 z-0 mb-0!"
              aria-hidden="true"
            />
            {children}
          </div>
        ) : useLabelContainer ? (
          // Standalone container mode: <label> enables click-to-focus on empty space.
          <label
            ref={forwardedRef as React.Ref<HTMLLabelElement>}
            {...dataProps}
            className={cn(containerClassName, 'mb-0!')}
            {...rest}
          >
            {children}
          </label>
        ) : (
          // Individual mode: <div> avoids :hover propagating to the first labelable sibling.
          <div
            ref={forwardedRef as React.Ref<HTMLDivElement>}
            {...dataProps}
            className={containerClassName}
            {...rest}
          >
            {children}
          </div>
        )}
      </InputGroupContext.Provider>
    );

    if (label) {
      return (
        <Field
          label={label}
          description={description}
          error={error}
          required={required}
          labelTooltip={labelTooltip}
        >
          {container}
        </Field>
      );
    }

    return container;
  },
);
Root.displayName = 'InputGroup';

/** @deprecated Use `InputGroup.Addon` instead. */
const Label = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof Addon>>((props, ref) => (
  <Addon ref={ref} align="start" {...props} />
));
Label.displayName = 'InputGroup.Label';

/** @deprecated Use `InputGroup.Suffix` instead. */
const Description = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof Suffix>>(
  (props, ref) => <Suffix ref={ref} {...props} />,
);
Description.displayName = 'InputGroup.Description';

export const InputGroup = Object.assign(Root, {
  Input,
  Button,
  Addon,
  Suffix,
  /** @deprecated Use `InputGroup.Addon` instead. */
  Label,
  /** @deprecated Use `InputGroup.Suffix` instead. */
  Description,
});

export type { InputGroupRootProps } from './input-group-context';
