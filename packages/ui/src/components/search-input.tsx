'use client';

import * as React from 'react';

import { cn } from '../lib/utils';
import { MagnifyingGlassIcon, XIcon } from './icons';
import { inputVariants } from './input';

/**
 * A search box: magnifier, clear button (also Escape) and `type="search"` so phones show the
 * search keyboard. Controlled (`value` + `onValueChange`) or uncontrolled. It does not fetch;
 * the caller filters or runs the search from `onValueChange` / `onSubmit`.
 */
function SearchInput({
  value: valueProp,
  defaultValue = '',
  onValueChange,
  onSubmit,
  clearLabel = 'Clear search',
  className,
  inputClassName,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type' | 'value' | 'defaultValue' | 'onSubmit'> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Called on Enter. */
  onSubmit?: (value: string) => void;
  clearLabel?: string;
  inputClassName?: string;
}) {
  const [inner, setInner] = React.useState(defaultValue);
  const controlled = valueProp !== undefined;
  const value = controlled ? valueProp : inner;
  const ref = React.useRef<HTMLInputElement>(null);
  const set = (v: string) => {
    if (!controlled) setInner(v);
    onValueChange?.(v);
  };
  const clear = () => {
    set('');
    ref.current?.focus();
  };
  return (
    <div data-slot="search-input" role="search" className={cn('relative min-w-0', className)}>
      <MagnifyingGlassIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        ref={ref}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        onChange={(e) => set(e.target.value)}
        onKeyDown={(e) => {
          props.onKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (e.key === 'Escape' && value) {
            e.preventDefault();
            clear();
          } else if (e.key === 'Enter') onSubmit?.(value);
        }}
        {...props}
        className={cn(
          inputVariants({ focusIndicator: true }),
          'w-full min-w-0 pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden',
          inputClassName,
        )}
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label={clearLabel}
          className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-tint hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <XIcon aria-hidden className="size-4" />
        </button>
      )}
    </div>
  );
}

export { SearchInput };
