'use client';

import { toast } from '@app/ui/components/toaster';
import { Button } from '@app/ui/components/button';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { type ReactNode, useActionState, useEffect, useRef } from 'react';

import type { ActionName } from '@/lib/action-names';
import { invokeAction } from '@/lib/invoke';
import { isStaleDeploy, promptReload } from '@/lib/stale-deploy';

import { FormError } from './field-error';
import { TurnstileWidget } from './turnstile';
import { useCloseDialog } from './form-dialog';

type FieldErrors = Record<string, string[] | undefined>;

type State =
  | { status: 'idle' }
  | { status: 'ok'; at: number; data: unknown }
  | {
      status: 'error';
      at: number;
      message: string;
      ref?: string;
      fieldErrors?: FieldErrors;
    };

/** How to turn a form field's text into the action's input. Text stays text; say what else it is. */
type FieldKind = 'number' | 'boolean' | 'json';

type FormInput = Record<string, unknown>;

/**
 * FormData → the action's input object:
 * - a blank text field is left out (or `null` with `blank="null"`, for forms that can clear a value);
 * - a name repeated, or ending in `[]`, becomes an array (checkbox groups, <select multiple>);
 * - fields named in `kinds` become numbers / booleans / parsed JSON; a checkbox is `true` when ticked
 *   and `false` when not.
 */
export function formDataToInput(
  data: FormData,
  kinds: Record<string, FieldKind> = {},
  blank: 'omit' | 'null' = 'omit',
): FormInput {
  const out: FormInput = {};
  const groups = new Map<string, FormDataEntryValue[]>();
  for (const [rawKey, value] of data.entries()) {
    if (
      rawKey.startsWith('$ACTION_') ||
      rawKey.startsWith('_') ||
      rawKey.startsWith('cf-turnstile')
    )
      continue; // React's and the bot check's own fields
    const key = rawKey.replace(/\[\]$/, '');
    const list = groups.get(key) ?? [];
    list.push(value);
    groups.set(key, list);
    if (rawKey.endsWith('[]')) kinds = { ...kinds, [`${key}[]`]: 'json' };
  }
  const arrayKeys = new Set(
    [...data.keys()].filter((k) => k.endsWith('[]')).map((k) => k.replace(/\[\]$/, '')),
  );
  for (const [key, list] of groups) {
    const texts = list.filter((v): v is string => typeof v === 'string');
    const kind = kinds[key];
    if (arrayKeys.has(key) || texts.length > 1) {
      out[key] = texts.map((v) => coerce(v, kind)).filter((v) => v !== '');
      continue;
    }
    const text = texts[0] ?? '';
    if (kind === 'boolean') {
      out[key] = text !== 'false' && text !== '';
    } else if (text.trim() === '') {
      if (blank === 'null') out[key] = null;
    } else {
      out[key] = coerce(text, kind);
    }
  }
  for (const [key, kind] of Object.entries(kinds)) {
    if (kind === 'boolean' && !(key in out)) out[key] = false; // an unticked checkbox sends nothing
  }
  return out;
}

function coerce(text: string, kind: FieldKind | undefined): unknown {
  if (kind === 'number') {
    const n = Number(text);
    return Number.isNaN(n) ? text : n;
  }
  if (kind === 'json') {
    try {
      return JSON.parse(text);
    } catch {
      // Expected: not JSON — keep the text and let the action's validation say what is wrong.
      return text;
    }
  }
  return text;
}

/**
 * The form for any action: `<ActionForm action="projects.create" success="Project created">` + fields.
 * Fields are `<Field label error={errors.name}><Input name="name" /></Field>`; pass a function as the
 * children to receive `errors` (each field's own message from the action's validation).
 *
 * On success: toast, refresh the page's data, close the enclosing <FormDialog>, reset the form.
 * On failure: the message plus the `E-…` reference with a copy button, and each field's own message.
 */
export function ActionForm({
  action,
  children,
  success,
  kinds,
  blank = 'omit',
  transform,
  onSuccess,
  submitLabel,
  submitVariant = 'primary',
  className,
  keepOpen = false,
  humanCheck = false,
}: {
  action: ActionName;
  /** Fields, or a function receiving each field's error message (`errors.name`). */
  children: ReactNode | ((errors: Record<string, string | undefined>) => ReactNode);
  success?: string;
  /** Which fields are numbers / booleans / JSON (everything else stays text). */
  kinds?: Record<string, FieldKind>;
  blank?: 'omit' | 'null';
  /** Last step: shape the input exactly (add an id, rename a field …). */
  transform?: (input: FormInput, form: FormData) => unknown;
  onSuccess?: (data: unknown) => void;
  /** Adds a primary submit button with this label (leave out to render your own). */
  submitLabel?: string;
  submitVariant?: 'primary' | 'secondary';
  className?: string;
  /** Don't close the enclosing dialog / reset the form after a save. */
  keepOpen?: boolean;
  /** A public form whose action has `humanCheck`: shows the Turnstile widget (when its keys are set) and sends its answer. */
  humanCheck?: boolean;
}) {
  const t = useTranslations('forms');
  const router = useRouter();
  const closeDialog = useCloseDialog();
  const formRef = useRef<HTMLFormElement>(null);
  const handled = useRef(0);

  const [state, submit, pending] = useActionState<State, FormData>(
    async (_prev, form) => {
      const input = formDataToInput(form, kinds, blank);
      const body = transform ? transform(input, form) : input;
      try {
        const token = humanCheck ? form.get('cf-turnstile-response') : null;
        const res = await invokeAction(action, body, {
          humanToken: typeof token === 'string' ? token : null,
        });
        if (res.ok) return { status: 'ok', at: Date.now(), data: res.data };
        const details = res.error.details as { fieldErrors?: FieldErrors } | undefined;
        return {
          status: 'error',
          at: Date.now(),
          message: res.error.message,
          ref: res.error.ref,
          fieldErrors: details?.fieldErrors,
        };
      } catch (err) {
        if (isStaleDeploy(err)) {
          promptReload();
          return {
            status: 'error',
            at: Date.now(),
            message: t('staleDeploy'),
          };
        }
        throw err;
      }
    },
    { status: 'idle' },
  );

  useEffect(() => {
    if (state.status !== 'ok' || handled.current === state.at) return;
    handled.current = state.at;
    if (success) toast.success(success);
    router.refresh();
    onSuccess?.(state.data);
    if (!keepOpen) {
      formRef.current?.reset();
      closeDialog?.();
    }
  }, [state, success, router, onSuccess, closeDialog, keepOpen]);

  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;
  const errors: Record<string, string | undefined> = {};
  for (const [name, messages] of Object.entries(fieldErrors ?? {})) errors[name] = messages?.[0];

  return (
    <form ref={formRef} action={submit} noValidate={false} className={className ?? 'grid gap-4'}>
      <fieldset disabled={pending} className="grid min-w-0 gap-4">
        {typeof children === 'function' ? children(errors) : children}
        {humanCheck && <TurnstileWidget />}
        {state.status === 'error' && (
          <FormError
            message={
              // Per-field problems are shown under their fields; don't repeat the whole zod message.
              Object.keys(errors).length > 0 ? t('checkFields') : state.message
            }
            reference={state.ref}
          />
        )}
        {submitLabel && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="submit" variant={submitVariant} loading={pending}>
              {submitLabel}
            </Button>
          </div>
        )}
      </fieldset>
    </form>
  );
}
