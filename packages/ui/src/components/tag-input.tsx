'use client';

import { Field as FieldBase } from '@base-ui/react/field';
import { XIcon } from './icons';
import type * as React from 'react';
import { useId, useState } from 'react';

import { cn } from '../lib/utils';
import { inputVariants } from './input';
import { useFieldControlProps } from './label';

/**
 * Free-text tags typed into one box: Enter or comma adds one, Backspace on an
 * empty box removes the last, × removes any. `suggestions` (e.g. tags already
 * used elsewhere) show as you type. Case-insensitive duplicates are ignored.
 *
 *   <Field label="Tags"><TagInput value={tags} onChange={setTags} suggestions={all} /></Field>
 */
function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = 'Add a tag…',
  maxTags = 20,
  maxLength = 40,
  className,
  ...rest
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  maxTags?: number;
  maxLength?: number;
  className?: string;
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: React.AriaAttributes['aria-invalid'];
}) {
  // Base UI's Field.Control picks the id the label points at; only a caller's own id overrides it.
  const { id: fieldId, ...fieldProps } = useFieldControlProps(rest);
  void fieldId;
  const props = rest.id ? { ...fieldProps, id: rest.id } : fieldProps;
  const listId = useId();
  const [text, setText] = useState('');
  const has = (t: string) => value.some((v) => v.toLowerCase() === t.toLowerCase());

  function add(raw: string) {
    const parts = raw
      .split(',')
      .map((t) => t.trim().slice(0, maxLength))
      .filter(Boolean);
    const next = [...value];
    for (const p of parts) {
      if (next.length >= maxTags) break;
      if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p);
    }
    if (next.length !== value.length) onChange(next);
    setText('');
  }

  return (
    <div
      data-slot="tag-input"
      className={cn(
        inputVariants({
          variant: props['aria-invalid'] ? 'error' : 'default',
          parentFocusIndicator: true,
        }),
        'flex h-auto min-h-9 w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 px-2 py-1.5',
        className,
      )}
    >
      {value.map((t) => (
        <span
          key={t}
          className="flex h-6 w-fit max-w-full shrink-0 items-center gap-2.5 rounded-sm bg-overlay py-0 pr-[3px] pl-2 text-sm text-foreground ring-1 ring-hairline"
        >
          <span className="truncate">{t}</span>
          <button
            type="button"
            aria-label={`Remove ${t}`}
            onClick={() => onChange(value.filter((v) => v !== t))}
            className="flex cursor-pointer rounded-md bg-transparent p-1 text-muted-foreground outline-none hover:bg-fill-hover hover:text-foreground focus-visible:ring-[1.5px] focus-visible:ring-ring"
          >
            <XIcon className="size-2.5" />
          </button>
        </span>
      ))}
      {value.length < maxTags && (
        <FieldBase.Control
          render={(controlProps) => (
            <input
              {...(controlProps as React.ComponentProps<'input'>)}
              {...props}
              list={listId}
              value={text}
              placeholder={value.length ? '' : placeholder}
              maxLength={maxLength + 1}
              autoComplete="off"
              onChange={(e) => {
                const v = e.target.value;
                if (v.includes(',')) add(v);
                else setText(v);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add(text);
                } else if (e.key === 'Backspace' && !text && value.length) {
                  onChange(value.slice(0, -1));
                }
              }}
              onBlur={() => text.trim() && add(text)}
              className="h-6 min-w-24 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-placeholder"
            />
          )}
        />
      )}
      <datalist id={listId}>
        {suggestions
          .filter((s) => !has(s))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  );
}

export { TagInput };
