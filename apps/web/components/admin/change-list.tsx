import { Badge } from '@app/ui/components/badge';
import { DetailItem, DetailList } from '@app/ui/components/detail-list';
import { focusRing } from '@app/ui/components/link';
import { cn } from '@app/ui/lib/utils';

import { fieldLabel, humanize, isBookkeeping, tableLabel } from '@/lib/labels';

type ChangeItem = {
  id: string;
  occurredAt?: Date;
  tableName: string;
  op: string;
  before: unknown;
  after: unknown;
  /** Present when listing a record's history: who made the change. */
  who?: string;
};

const OP: Record<string, { label: string; color: 'green' | 'blue' | 'red' }> = {
  insert: { label: 'Added', color: 'green' },
  update: { label: 'Changed', color: 'blue' },
  delete: { label: 'Removed', color: 'red' },
};

/** How many changes show before "Show all". */
const SHOWN = 5;

/**
 * Field-level changes (from app.change_log): for each row, every field that
 * changed with its old and new value. Ids and timestamps are left out; the
 * newest five show, the rest behind "Show all".
 */
export function ChangeList({ changes }: { changes: ChangeItem[] }) {
  if (changes.length === 0) {
    return <p className="text-sm text-muted-foreground">No data changed.</p>;
  }
  const first = changes.slice(0, SHOWN);
  const rest = changes.slice(SHOWN);
  return (
    <div className="grid gap-4">
      {first.map((c) => (
        <Change key={c.id} c={c} />
      ))}
      {rest.length > 0 && (
        <details className="group grid gap-4">
          <summary
            className={cn(
              'cursor-pointer list-none text-sm font-medium text-primary group-open:mb-4 hover:underline',
              focusRing,
            )}
          >
            <span className="group-open:hidden">Show all {changes.length} changes</span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>
          <div className="grid gap-4">
            {rest.map((c) => (
              <Change key={c.id} c={c} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function Change({ c }: { c: ChangeItem }) {
  const before = asRecord(c.before);
  const after = asRecord(c.after);
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (f) =>
      !isBookkeeping(f) &&
      (c.op === 'update'
        ? JSON.stringify(before[f]) !== JSON.stringify(after[f])
        : (c.op === 'delete' ? before[f] : after[f]) != null),
  );
  const op = OP[c.op] ?? { label: humanize(c.op), color: 'blue' as const };
  return (
    <div className="grid gap-2">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <Badge color={op.color}>{op.label}</Badge>
        <span className="font-medium">{tableLabel(c.tableName)}</span>
        {c.who && <span className="text-xs text-muted-foreground">by {c.who}</span>}
      </p>
      {fields.length > 0 && (
        <DetailList className="gap-y-2 rounded-lg border border-hairline p-3 text-xs sm:gap-y-1">
          {fields.map((f) => (
            <DetailItem key={f} label={fieldLabel(f)}>
              {c.op === 'update' ? (
                <>
                  <span className="text-muted-foreground line-through">{show(before[f])}</span> →{' '}
                  <span className="font-medium">{show(after[f])}</span>
                </>
              ) : (
                show(c.op === 'delete' ? before[f] : after[f])
              )}
            </DetailItem>
          ))}
        </DetailList>
      )}
    </div>
  );
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

function show(v: unknown) {
  if (v === null || v === undefined || v === '') return '(empty)';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v && 'line1' in v) {
    const a = v as Record<string, string | undefined>;
    return [a.line1, a.line2, a.city, `${a.state ?? ''} ${a.postal_code ?? a.postalCode ?? ''}`]
      .filter((x) => x && x.trim())
      .join(', ');
  }
  return JSON.stringify(v);
}
