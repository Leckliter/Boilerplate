'use client';

import { Autocomplete as AutocompletePrimitive } from '@base-ui/react/autocomplete';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { inputVariants } from './input';
import { useFieldControlProps } from './label';

/**
 * A text box that suggests values as you type — suggestions you load yourself
 * (e.g. Google address suggestions). Typing still works without picking one.
 * Picking one calls `onSelect`; the text box keeps whatever `value` you set.
 *
 *   <Field label="Street address">
 *     <Autocomplete value={text} onValueChange={setText} items={found}
 *       itemToString={(s) => s.text} onSelect={fill} footer="Suggestions by Google Maps" />
 *   </Field>
 */
function Autocomplete<T>({
  value,
  onValueChange,
  items,
  itemToString,
  itemKey = itemToString,
  renderItem,
  onSelect,
  status,
  footer,
  name,
  required,
  className,
  ...rest
}: {
  /** The text in the box. */
  value: string;
  /** The person typed (not called when they pick a suggestion). */
  onValueChange: (value: string) => void;
  /** The current suggestions (already filtered: nothing is filtered here). */
  items: T[];
  itemToString: (item: T) => string;
  itemKey?: (item: T) => string;
  renderItem?: (item: T) => React.ReactNode;
  onSelect: (item: T) => void;
  /** Shown above the list, e.g. "Searching…". */
  status?: React.ReactNode;
  /** Shown under the list, e.g. an attribution. */
  footer?: React.ReactNode;
} & Omit<React.ComponentProps<'input'>, 'value' | 'defaultValue' | 'onChange' | 'onSelect'>) {
  // Base UI picks the id the field's label points at; only a caller's own id overrides it.
  const { id: fieldId, ...fieldProps } = useFieldControlProps(rest);
  void fieldId;
  const props = rest.id ? { ...fieldProps, id: rest.id } : fieldProps;
  const open = items.length > 0 || Boolean(status);
  return (
    <AutocompletePrimitive.Root
      items={items}
      value={value}
      name={name}
      required={required}
      filter={null}
      itemToStringValue={itemToString}
      onValueChange={(next, details) => {
        if (details.reason === 'item-press') {
          const picked = items.find((i) => itemToString(i) === next);
          if (picked) onSelect(picked);
          return;
        }
        onValueChange(next);
      }}
    >
      <AutocompletePrimitive.Input
        data-slot="autocomplete-input"
        className={cn(
          inputVariants({
            variant: props['aria-invalid'] ? 'error' : 'default',
            focusIndicator: true,
          }),
          'w-full min-w-0',
          className,
        )}
        {...props}
      />
      <AutocompletePrimitive.Portal hidden={!open}>
        <AutocompletePrimitive.Positioner
          className="z-50 outline-none"
          sideOffset={4}
          align="start"
        >
          <AutocompletePrimitive.Popup
            data-slot="autocomplete-content"
            className={cn(
              'w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) rounded-lg bg-control py-1.5 text-foreground shadow-lg ring ring-border outline-none',
              'transition-[scale,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
            )}
          >
            <div className="max-h-[min(var(--available-height),20rem)] overflow-y-auto overscroll-contain">
              <AutocompletePrimitive.Status>
                {status && (
                  <div className="mx-1.5 px-2 py-1.5 text-sm text-muted-foreground">{status}</div>
                )}
              </AutocompletePrimitive.Status>
              <AutocompletePrimitive.List>
                {(item: T) => (
                  <AutocompletePrimitive.Item
                    key={itemKey(item)}
                    value={item}
                    className="mx-1.5 flex cursor-pointer rounded px-2 py-1.5 text-base outline-none select-none data-highlighted:bg-tint"
                  >
                    {renderItem ? renderItem(item) : itemToString(item)}
                  </AutocompletePrimitive.Item>
                )}
              </AutocompletePrimitive.List>
            </div>
            {footer && items.length > 0 && (
              <div className="mx-3.5 pt-1.5 pb-0.5 text-right text-xs text-muted-foreground">
                {footer}
              </div>
            )}
          </AutocompletePrimitive.Popup>
        </AutocompletePrimitive.Positioner>
      </AutocompletePrimitive.Portal>
    </AutocompletePrimitive.Root>
  );
}

export { Autocomplete };
