'use client';

/**
 * Text inputs, built on `input` and `input-area`.
 *
 * Sizes `xs | sm | base | lg`, a quiet ring instead of a border, a 1.5px focus ring and a
 * red ring for errors. Pass `label` / `description` / `error` for a ready-made field, or put
 * the input in a `<Field>` (it then picks up the id, hint and error by itself).
 */
import { Field as FieldBase } from '@base-ui/react/field';
import { Input as InputPrimitive } from '@base-ui/react/input';
import type * as React from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import { cn } from '../lib/utils';
import { Field, normalizeFieldError, useFieldControlProps } from './label';
import type { FieldError } from './label';

type InputSize = 'xs' | 'sm' | 'base' | 'lg';
type InputVariant = 'default' | 'error';

const sizeClasses: Record<InputSize, string> = {
  xs: 'h-5 gap-1 rounded-sm px-1.5 text-xs',
  sm: 'h-6.5 gap-1 rounded-md px-2 text-xs',
  base: 'h-9 gap-1.5 rounded-lg px-3 text-base',
  lg: 'h-10 gap-2 rounded-lg px-4 text-base',
};

/**
 * The look of every text box: use on any element that should look like an input
 * (`inputVariants({ size, variant })`). `parentFocusIndicator` rings the box when a child
 * has focus (a wrapper around a bare <input>); `focusIndicator` rings the element itself.
 */
function inputVariants({
  size = 'base',
  variant = 'default',
  parentFocusIndicator = false,
  focusIndicator = false,
}: {
  size?: InputSize;
  variant?: InputVariant;
  parentFocusIndicator?: boolean;
  focusIndicator?: boolean;
} = {}) {
  const error = variant === 'error';
  return cn(
    'border-0 bg-control text-foreground ring ring-border outline-none focus:outline-hidden',
    'placeholder:text-placeholder disabled:cursor-not-allowed disabled:text-inactive',
    sizeClasses[size] ?? sizeClasses.base,
    error
      ? 'ring-destructive focus:ring-[1.5px] focus:ring-destructive/50'
      : 'focus:ring-[1.5px] focus:ring-ring',
    parentFocusIndicator && 'has-focus-visible:outline-hidden',
    parentFocusIndicator &&
      (error
        ? 'focus-within:ring-[1.5px] focus-within:ring-destructive/50'
        : 'focus-within:ring-[1.5px] focus-within:ring-ring'),
    focusIndicator &&
      (error
        ? 'focus:ring-[1.5px] focus:ring-destructive/50'
        : 'focus:ring-[1.5px] focus:ring-ring'),
  );
}

/** Classes for a bare control that should look like an input (kept for older call sites). */
const controlClasses = cn(inputVariants(), 'w-full min-w-0');

/**
 * For controls drawn through Base UI's `Field.Control`: it already picks the id the label points
 * at, so only an id the caller set themselves may override it.
 */
function withoutFieldId<P extends { id?: string }>(props: P, own: string | undefined): P {
  const { id: _fieldId, ...rest } = props;
  void _fieldId;
  return (own ? { ...rest, id: own } : rest) as P;
}

type FieldProps = {
  /** Label above the box (turns the input into a ready-made field). */
  label?: React.ReactNode;
  /** Info-icon tooltip next to the label. */
  labelTooltip?: React.ReactNode;
  /** Help text under the box. */
  description?: React.ReactNode;
  /** Error message (or `{ message, match }`); turns the ring red. */
  error?: FieldError;
};

type InputProps = Omit<React.ComponentProps<'input'>, 'size'> &
  FieldProps & {
    size?: InputSize;
    variant?: InputVariant;
    /** Stop password managers decorating a field that isn't a login. */
    passwordManagerIgnore?: boolean;
  };

function Input({
  className,
  size = 'base',
  variant: variantProp,
  label,
  labelTooltip,
  description,
  error,
  passwordManagerIgnore = false,
  ...rest
}: InputProps) {
  const props = useFieldControlProps(rest);
  const invalid = props['aria-invalid'] === true || props['aria-invalid'] === 'true';
  const variant = variantProp ?? (error || invalid ? 'error' : 'default');
  const input = (
    <InputPrimitive
      data-slot="input"
      className={cn(
        inputVariants({ size, variant, focusIndicator: true }),
        'w-full min-w-0 file:border-0 file:bg-transparent file:text-sm file:font-medium',
        passwordManagerIgnore && 'keeper-ignore',
        className,
      )}
      {...(passwordManagerIgnore
        ? {
            'data-1p-ignore': 'true',
            'data-bwignore': 'true',
            'data-form-type': 'other',
            'data-lpignore': 'true',
          }
        : {})}
      {...props}
      aria-invalid={error ? true : props['aria-invalid']}
    />
  );
  if (label || error || description) {
    return (
      <Field
        label={label}
        required={props.required}
        labelTooltip={labelTooltip}
        description={description}
        error={normalizeFieldError(error)}
      >
        {input}
      </Field>
    );
  }
  return input;
}

/* ── Textarea ──────────────────────────────────────────────────────── */

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function parsePx(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Grows a textarea with its content (between `minRows` and `maxRows`, then it scrolls).
 * Measures after every render and when the width changes (text re-wraps).
 */
function useTextareaAutoResize({
  enabled,
  minRows,
  maxRows,
}: {
  enabled: boolean;
  minRows: number;
  maxRows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const resize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!enabled || !textarea || typeof window === 'undefined') return;

    const style = window.getComputedStyle(textarea);
    const borders = parsePx(style.borderTopWidth) + parsePx(style.borderBottomWidth);
    const padding = parsePx(style.paddingTop) + parsePx(style.paddingBottom);
    const isBorderBox = style.boxSizing === 'border-box';

    textarea.style.height = 'auto';
    let height = isBorderBox ? textarea.scrollHeight + borders : textarea.scrollHeight - padding;

    const fontSize = parsePx(style.fontSize);
    const raw = style.lineHeight;
    const lineHeight =
      raw === 'normal' || raw === ''
        ? fontSize * 1.2
        : raw.endsWith('px')
          ? parsePx(raw)
          : parsePx(raw) * fontSize;
    const boxSpacing = isBorderBox ? padding + borders : 0;
    const min = minRows;
    const max = maxRows;
    if (min > 0 || (max && max > 0)) {
      height = Math.max(height, lineHeight * min + boxSpacing);
      if (max && max > 0) {
        const maxHeight = lineHeight * max + boxSpacing;
        if (height > maxHeight) {
          height = maxHeight;
          textarea.style.overflowY = 'auto';
        } else {
          textarea.style.overflowY = 'hidden';
        }
      } else {
        textarea.style.overflowY = 'hidden';
      }
    } else {
      textarea.style.overflowY = 'hidden';
    }
    textarea.style.height = `${height}px`;
  }, [enabled, minRows, maxRows]);

  useIsomorphicLayoutEffect(() => {
    if (enabled) resize();
  });

  useIsomorphicLayoutEffect(() => {
    if (!enabled) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    let lastWidth = textarea.clientWidth;
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (textarea.clientWidth !== lastWidth) {
              lastWidth = textarea.clientWidth;
              resize();
            }
          })
        : null;
    observer?.observe(textarea);
    return () => {
      observer?.disconnect();
      textarea.style.height = '';
      textarea.style.overflowY = '';
    };
  }, [enabled, resize]);

  return { textareaRef, resize };
}

type TextareaProps = Omit<React.ComponentProps<'textarea'>, 'size'> &
  FieldProps & {
    size?: InputSize;
    variant?: InputVariant;
    onValueChange?: (value: string) => void;
    /** Grow with the text (instead of the default fixed-height box you can drag). */
    autoResize?: boolean;
    /** With `autoResize`: fewest rows to show. */
    minRows?: number;
    /** With `autoResize`: most rows before it scrolls. */
    maxRows?: number;
  };

function Textarea({
  className,
  size = 'base',
  variant: variantProp,
  label,
  labelTooltip,
  description,
  error,
  autoResize = false,
  minRows = 1,
  maxRows,
  rows,
  onChange,
  onValueChange,
  ref,
  ...rest
}: TextareaProps) {
  const props = withoutFieldId(useFieldControlProps(rest), rest.id);
  const invalid = props['aria-invalid'] === true || props['aria-invalid'] === 'true';
  const variant = variantProp ?? (error || invalid ? 'error' : 'default');
  const { textareaRef, resize } = useTextareaAutoResize({ enabled: autoResize, minRows, maxRows });
  const isControlled = props.value !== undefined;

  const setRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      textareaRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref, textareaRef],
  );

  const textarea = (
    <FieldBase.Control
      render={(controlProps) => (
        <textarea
          {...(controlProps as React.ComponentProps<'textarea'>)}
          {...props}
          ref={setRef}
          data-slot="textarea"
          rows={autoResize ? minRows : rows}
          aria-invalid={error ? true : props['aria-invalid']}
          onChange={(event) => {
            onChange?.(event);
            onValueChange?.(event.target.value);
            if (!isControlled) resize();
          }}
          className={cn(
            inputVariants({ size, variant, focusIndicator: true }),
            'h-auto w-full min-w-0 py-2',
            autoResize
              ? 'resize-none scroll-pb-2 [scrollbar-width:thin]'
              : 'field-sizing-content min-h-20',
            className,
          )}
        />
      )}
    />
  );
  if (label || error || description) {
    return (
      <Field
        label={label}
        required={props.required}
        labelTooltip={labelTooltip}
        description={description}
        error={normalizeFieldError(error)}
      >
        {textarea}
      </Field>
    );
  }
  return textarea;
}

/* ── NativeSelect ──────────────────────────────────────────────────── */

/** A styled native <select> — the right choice for forms and mobile. For a custom menu see `Select`. */
function NativeSelect({
  className,
  size = 'base',
  ...rest
}: Omit<React.ComponentProps<'select'>, 'size'> & { size?: InputSize }) {
  const props = withoutFieldId(useFieldControlProps(rest), rest.id);
  const invalid = props['aria-invalid'] === true || props['aria-invalid'] === 'true';
  return (
    <FieldBase.Control
      render={(controlProps) => (
        <select
          {...(controlProps as React.ComponentProps<'select'>)}
          {...props}
          data-slot="native-select"
          className={cn(
            inputVariants({ size, variant: invalid ? 'error' : 'default', focusIndicator: true }),
            'w-full min-w-0 appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%2716%27%20height%3D%2716%27%20fill%3D%27none%27%20stroke%3D%27%23737373%27%20stroke-width%3D%272%27%20viewBox%3D%270%200%2024%2024%27%3E%3Cpath%20d%3D%27m6%209%206%206%206-6%27/%3E%3C/svg%3E")] bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-8',
            className,
          )}
        />
      )}
    />
  );
}

export { controlClasses, Input, inputVariants, NativeSelect, Textarea };
export type { InputProps, InputSize, InputVariant, TextareaProps };
