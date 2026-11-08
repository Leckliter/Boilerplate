import { Badge } from '@app/ui/components/badge';
import { focusRing } from '@app/ui/components/link';
import { formatDateTime } from '@app/ui/lib/dates';
import { cn } from '@app/ui/lib/utils';
import { EyeIcon, GearSixIcon, RobotIcon, SignInIcon, UserIcon } from '@app/ui/components/icons';
import Link from 'next/link';

type ActivityItem = {
  id: string;
  occurredAt: Date;
  kind: 'change' | 'read' | 'auth';
  action: string;
  actorKind: 'user' | 'api_key' | 'system' | 'guest';
  actorName: string | null;
  apiKeyName: string | null;
  channel: string;
  summary: string | null;
  ok: boolean;
  error: string | null;
  errorCode: string | null;
  errorRef: string | null;
  ip: string | null;
};

/** "Nov 3, 2026, 4:05 PM" in Central time (kept as an object for existing `timeFormat.format(d)` callers). */
export const timeFormat = { format: (d: Date | string | number) => formatDateTime(d) };

/** "Ann Lee", "Claude (API key of Ann Lee)", "System", "Website visitor". */
export function actorLabel(e: {
  actorKind: ActivityItem['actorKind'] | null;
  actorName: string | null;
  apiKeyName?: string | null;
}) {
  if (e.actorKind === 'api_key') {
    return `${e.apiKeyName ?? 'API key'} (API key of ${e.actorName ?? 'a deleted contact'})`;
  }
  if (e.actorKind === 'system') return 'System';
  if (e.actorKind === 'guest') return 'Website visitor';
  if (e.actorKind === null) return 'Not recorded';
  return e.actorName ?? 'A deleted contact';
}

const FAILURE_LABEL: Record<string, string> = {
  forbidden: 'Denied',
  unauthenticated: 'Denied',
  invalid_input: 'Invalid input',
  internal: 'Error',
  auth_failed: 'Failed',
};

export function ActivityList({ entries }: { entries: ActivityItem[] }) {
  if (entries.length === 0)
    return <p className="text-sm text-muted-foreground">Nothing has happened here yet.</p>;
  return (
    <ul className="grid gap-1">
      {entries.map((e) => {
        const Icon =
          e.kind === 'auth'
            ? SignInIcon
            : e.actorKind === 'api_key'
              ? RobotIcon
              : e.actorKind === 'system'
                ? GearSixIcon
                : UserIcon;
        return (
          <li key={e.id}>
            <Link
              href={`/admin/activity/${e.id}`}
              className={cn(
                '-mx-2 flex items-start gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-accent',
                focusRing,
              )}
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  {e.summary ?? e.action}
                  {e.kind === 'read' && (
                    <EyeIcon className="ml-1.5 inline size-3.5 text-muted-foreground" />
                  )}
                  {!e.ok && (
                    <Badge color="red" className="ml-2">
                      {FAILURE_LABEL[e.errorCode ?? ''] ?? 'Failed'}
                    </Badge>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {actorLabel(e)} · {e.channel} · {timeFormat.format(new Date(e.occurredAt))}
                  {e.ip && ` · ${e.ip}`}
                  {e.errorRef ? ` · ${e.errorRef}` : e.error && ` · ${e.error}`}
                </p>
              </div>
              <code className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                {e.action}
              </code>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
