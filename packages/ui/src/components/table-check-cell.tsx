'use client';

import * as React from 'react';

import { cn } from '../lib/utils';
import { Checkbox } from './checkbox';

type CheckProps = {
  checked?: boolean;
  indeterminate?: boolean;
  /** Called with the new checked state. */
  onCheckedChange?: (checked: boolean) => void;
  /** @deprecated Kumo name for `onCheckedChange`. */
  onValueChange?: (checked: boolean) => void;
  /** Accessible name of the checkbox. */
  label?: string;
  disabled?: boolean;
};

/** The checkbox inside a selection cell: a native checkbox whose `indeterminate` is kept in sync. */
function RowCheckbox({
  checked,
  indeterminate,
  onCheckedChange,
  onValueChange,
  label,
  disabled,
}: CheckProps & { label: string }) {
  const ref = React.useCallback(
    (el: HTMLInputElement | null) => {
      if (el) el.indeterminate = Boolean(indeterminate);
    },
    [indeterminate],
  );
  return (
    <Checkbox
      ref={ref}
      checked={checked}
      onChange={(e) => {
        onCheckedChange?.(e.target.checked);
        onValueChange?.(e.target.checked);
      }}
      aria-label={label}
      disabled={disabled}
      className="relative before:absolute before:-inset-3 before:content-['']"
    />
  );
}

/** A `<td>` with a row checkbox; the whole cell area is a hit target. */
export function TableCheckCell({
  checked,
  indeterminate,
  onCheckedChange,
  onValueChange,
  label,
  disabled,
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & CheckProps) {
  return (
    <td className={cn('w-10 leading-none', className)} {...props}>
      <RowCheckbox
        checked={checked}
        indeterminate={indeterminate}
        onCheckedChange={onCheckedChange}
        onValueChange={onValueChange}
        label={label ?? 'Select row'}
        disabled={disabled}
      />
    </td>
  );
}

/** A `<th>` with the select-all checkbox. */
export function TableCheckHead({
  checked,
  indeterminate,
  onCheckedChange,
  onValueChange,
  label,
  disabled,
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & CheckProps) {
  return (
    <th className={cn('w-10 leading-none', className)} {...props}>
      <RowCheckbox
        checked={checked}
        indeterminate={indeterminate}
        onCheckedChange={onCheckedChange}
        onValueChange={onValueChange}
        label={label ?? 'Select all rows'}
        disabled={disabled}
      />
    </th>
  );
}
