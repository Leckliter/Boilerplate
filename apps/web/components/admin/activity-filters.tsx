import { Button } from '@app/ui/components/button';
import { Input, NativeSelect } from '@app/ui/components/input';
import { Field } from '@app/ui/components/label';
import Link from 'next/link';

export type ActivityFilterValues = {
  from?: string;
  to?: string;
  actor?: string;
  channel?: string;
  failed?: boolean;
};

/**
 * The date / who / where filters above the activity list, as a plain GET form (no client code): the
 * values land in the URL, so a filtered view can be linked. `keep` carries the other parameters (the
 * kind tab, the search text) through the form.
 */
export function ActivityFilters({
  values,
  actors,
  keep,
}: {
  values: ActivityFilterValues;
  /** People to pick from (empty hides the "Who" box). */
  actors: { id: string; name: string }[];
  keep: Record<string, string | undefined>;
}) {
  const active = Boolean(
    values.from || values.to || values.actor || values.channel || values.failed,
  );
  return (
    <form
      method="get"
      action="/admin/activity"
      aria-label="Filter the activity"
      className="mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-card p-3 ring ring-border"
    >
      {Object.entries(keep).map(
        ([name, value]) => value && <input key={name} type="hidden" name={name} value={value} />,
      )}
      <Field label="From" className="min-w-36 flex-1">
        <Input type="date" name="from" defaultValue={values.from} />
      </Field>
      <Field label="To" className="min-w-36 flex-1">
        <Input type="date" name="to" defaultValue={values.to} />
      </Field>
      {actors.length > 0 && (
        <Field label="Who" className="min-w-40 flex-1">
          <NativeSelect name="actor" defaultValue={values.actor ?? ''}>
            <option value="">Anyone</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      <Field label="Channel" className="min-w-36 flex-1">
        <NativeSelect name="channel" defaultValue={values.channel ?? ''}>
          <option value="">All channels</option>
          <option value="web">Web</option>
          <option value="api">API</option>
          <option value="mcp">AI (MCP)</option>
          <option value="system">System</option>
          <option value="automation">Automation</option>
        </NativeSelect>
      </Field>
      <label className="flex min-h-9 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="failed"
          value="1"
          defaultChecked={values.failed}
          className="size-4 accent-primary"
        />
        Failed &amp; denied only
      </label>
      <div className="flex gap-2">
        <Button type="submit" variant="primary">
          Apply
        </Button>
        {active && (
          <Link
            href={`/admin/activity${keep.kind ? `?kind=${keep.kind}` : ''}`}
            className="inline-flex h-9 items-center px-3 text-sm text-muted-foreground underline underline-offset-4"
          >
            Reset
          </Link>
        )}
      </div>
    </form>
  );
}
