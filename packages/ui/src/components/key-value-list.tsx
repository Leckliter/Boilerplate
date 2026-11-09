import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Label → value pairs as a real description list. Data-driven (give it `items`), for summaries,
 * receipts and "about" blocks. For an editable record section use DetailList in an EditableCard.
 *
 *   <KeyValueList items={[{ label: 'Plan', value: 'Pro' }, { label: 'Seats', value: 4 }]} />
 */
type KeyValueItem = {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
};

function KeyValueList({
  items,
  layout = 'inline',
  className,
  ...props
}: Omit<React.ComponentProps<'dl'>, 'children'> & {
  items: KeyValueItem[];
  /** `inline`: label left, value right on wide screens. `stacked`: label above value. */
  layout?: 'inline' | 'stacked';
}) {
  return (
    <dl
      data-slot="key-value-list"
      className={cn('grid min-w-0 text-sm', layout === 'inline' ? 'gap-y-0' : 'gap-y-3', className)}
      {...props}
    >
      {items.map((item, i) => (
        <div
          key={i}
          className={cn(
            'min-w-0',
            layout === 'inline'
              ? 'flex flex-col gap-0.5 border-b border-hairline py-2.5 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6'
              : 'flex flex-col gap-0.5',
          )}
        >
          <dt className="shrink-0 text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 break-words text-foreground sm:text-right">
            {item.value}
            {item.hint && <span className="block text-xs text-muted-foreground">{item.hint}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export type { KeyValueItem };
export { KeyValueList };
