'use client';

/**
 * Label + Field, rebuilt on Cloudflare Kumo's (MIT) `label` and `field`.
 *
 * `Field` keeps our props (`label`, `hint`, `error`, `htmlFor`) and also takes Kumo's
 * (`description`, `required={false}` → "(optional)", `labelTooltip`, `controlFirst`,
 * `hideLabel`, and `error={{ message, match }}`). It is Base UI's Field underneath, so
 * a control inside gets its label, hint and error wired up for screen readers.
 */
import { Field as FieldBase } from '@base-ui/react/field';
import type * as React from 'react';
import { createContext, isValidElement, useContext, useId } from 'react';

import { cn } from '../lib/utils';
import { InfoIcon } from './icons';
import { useLocale } from './kumo-context';
import { Tooltip } from './tooltip';

/* ── Label ─────────────────────────────────────────────────────────── */

type LabelProps = Omit<React.ComponentProps<'label'>, 'children'> & {
  children?: React.ReactNode;
  /** Shows a quiet "(optional)" after the label. */
  showOptional?: boolean;
  /** Replaces the "(optional)" words. */
  optionalLabel?: React.ReactNode;
  /** Explains the field in a tooltip behind an info icon. */
  tooltip?: React.ReactNode;
  tooltipAriaLabel?: string;
  /**
   * Only the inline content (optional marker, tooltip), no `<label>` element or font styling —
   * for use inside another label that already styles the text.
   */
  asContent?: boolean;
};

function Label({
  children,
  showOptional = false,
  optionalLabel,
  tooltip,
  tooltipAriaLabel,
  asContent = false,
  className,
  ...props
}: LabelProps) {
  const { label } = useLocale();
  const optional = optionalLabel === undefined ? label.optional : optionalLabel;
  const content = (
    <>
      {children}
      {showOptional && <span className="font-normal text-muted-foreground">{optional}</span>}
      {tooltip && (
        <Tooltip content={tooltip}>
          <button
            type="button"
            aria-label={tooltipAriaLabel ?? label.tooltip}
            className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-fill-hover hover:text-foreground focus-visible:ring-[1.5px] focus-visible:ring-ring"
          >
            <InfoIcon className="size-4" />
          </button>
        </Tooltip>
      )}
    </>
  );
  if (asContent) {
    return <span className={cn('inline-flex items-center gap-1', className)}>{content}</span>;
  }
  return (
    <label
      data-slot="label"
      className={cn(
        'm-0 inline-flex items-center gap-1 text-base font-medium text-foreground',
        className,
      )}
      {...props}
    >
      {content}
    </label>
  );
}

/* ── Field ─────────────────────────────────────────────────────────── */

/** Which browser validation result shows the error ("true" = always). */
type FieldErrorMatch =
  | boolean
  | 'badInput'
  | 'customError'
  | 'patternMismatch'
  | 'rangeOverflow'
  | 'rangeUnderflow'
  | 'stepMismatch'
  | 'tooLong'
  | 'tooShort'
  | 'typeMismatch'
  | 'valid'
  | 'valueMissing';

type FieldErrorObject = { message: React.ReactNode; match: FieldErrorMatch };
/** A message, or Kumo's `{ message, match }`. */
type FieldError = React.ReactNode | FieldErrorObject;

function isErrorObject(error: unknown): error is FieldErrorObject {
  return (
    typeof error === 'object' &&
    error !== null &&
    !isValidElement(error) &&
    'message' in error &&
    'match' in error
  );
}

/** Turns an error prop (message or `{ message, match }`) into `{ message, match }`; undefined when empty. */
function normalizeFieldError(error: FieldError): FieldErrorObject | undefined {
  if (!error) return undefined;
  if (isErrorObject(error)) return error;
  return { message: error, match: true };
}

type FieldContextValue = { id: string; describedBy?: string; invalid: boolean };
const FieldContext = createContext<FieldContextValue | null>(null);

/**
 * What a control inside a <Field> should add to its own props: the field's id
 * (so the label points at it), aria-describedby (hint/error read out by screen
 * readers) and aria-invalid (red ring). Input, Textarea, NativeSelect, TagInput
 * and Autocomplete use it.
 */
function useFieldControlProps<
  P extends {
    id?: string;
    'aria-describedby'?: string;
    'aria-invalid'?: React.AriaAttributes['aria-invalid'];
  },
>(props: P): P {
  const field = useContext(FieldContext);
  if (!field) return props;
  return {
    ...props,
    id: props.id ?? field.id,
    'aria-describedby':
      [props['aria-describedby'], field.describedBy].filter(Boolean).join(' ') || undefined,
    'aria-invalid': props['aria-invalid'] ?? (field.invalid || undefined),
  };
}

/** The grid a Field lays out. Checkboxes and switches go label-beside-control. */
function fieldVariants({ controlFirst = false }: { controlFirst?: boolean } = {}) {
  return cn(
    'grid gap-2',
    'has-[input[type=checkbox]]:grid-cols-[auto_1fr] has-[input[type=checkbox]]:items-center',
    'has-[[role=switch]]:grid-cols-[auto_1fr] has-[[role=switch]]:items-center',
    controlFirst && [
      'has-[input[type=checkbox]]:flex has-[input[type=checkbox]]:flex-row-reverse has-[input[type=checkbox]]:flex-wrap has-[input[type=checkbox]]:items-center',
      'has-[[role=switch]]:flex has-[[role=switch]]:flex-row-reverse has-[[role=switch]]:flex-wrap has-[[role=switch]]:items-center',
      '[&>label]:flex-1',
    ],
  );
}

function rendersNothing(node: React.ReactNode) {
  return node == null || typeof node === 'boolean' || node === '';
}

/**
 * Label + control + optional hint/error, stacked. Use for every form field.
 * The hint or error is linked to the control for screen readers, and an error
 * turns the control red — no extra props needed on the Input.
 *
 *   <Field label="Email" hint="We only use it for receipts" error={errors.email}>
 *     <Input type="email" />
 *   </Field>
 */
function Field({
  label,
  htmlFor,
  hint,
  description,
  error,
  required,
  labelTooltip,
  controlFirst = false,
  hideLabel = false,
  className,
  children,
}: {
  label?: React.ReactNode;
  /** Only needed when the control has its own id. */
  htmlFor?: string;
  /** Quiet help text under the control (hidden while there is an error). */
  hint?: React.ReactNode;
  /** Same as `hint` (Kumo's name). */
  description?: React.ReactNode;
  error?: FieldError;
  /** `false` adds a quiet "(optional)" after the label. */
  required?: boolean;
  labelTooltip?: React.ReactNode;
  /** Checkbox / switch: control before the label. */
  controlFirst?: boolean;
  /** Skip the `<label>` (the control labels itself, e.g. Select). */
  hideLabel?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const auto = useId();
  const id = htmlFor ?? auto;
  const noteId = `${id}-note`;
  const err = normalizeFieldError(error);
  const note = hint ?? description;
  const hasNote = !rendersNothing(err?.message) || !rendersNothing(note);
  const showOptional = required === false;
  const hasLabelContent = !rendersNothing(label) || showOptional || !rendersNothing(labelTooltip);
  return (
    <FieldContext.Provider
      value={{ id, describedBy: hasNote ? noteId : undefined, invalid: Boolean(err) }}
    >
      <FieldBase.Root
        data-slot="field"
        invalid={err ? true : undefined}
        className={cn(fieldVariants({ controlFirst }), className)}
      >
        {!hideLabel && hasLabelContent && (
          <FieldBase.Label
            {...(htmlFor ? { htmlFor } : {})}
            className="m-0 text-base font-medium text-foreground select-none"
          >
            <Label asContent showOptional={showOptional} tooltip={labelTooltip}>
              {label}
            </Label>
          </FieldBase.Label>
        )}
        {children}
        {err ? (
          <FieldBase.Error
            id={noteId}
            role="alert"
            match={err.match}
            className="col-span-full text-sm leading-snug text-destructive"
          >
            {err.message}
          </FieldBase.Error>
        ) : !rendersNothing(note) ? (
          <FieldBase.Description
            id={noteId}
            className="col-span-full text-sm leading-snug text-muted-foreground"
          >
            {note}
          </FieldBase.Description>
        ) : null}
      </FieldBase.Root>
    </FieldContext.Provider>
  );
}

export { Field, fieldVariants, Label, normalizeFieldError, useFieldControlProps };
export type { FieldError, FieldErrorMatch, FieldErrorObject, LabelProps };
