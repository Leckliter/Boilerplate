import { Badge } from '@app/ui/components/badge';

const COLORS = {
  running: 'blue',
  waiting: 'amber',
  completed: 'green',
  failed: 'red',
  cancelled: 'neutral',
  skipped: 'neutral',
  done: 'green',
} as const;

/** The status of an automation run or one of its steps. */
export function RunStatusBadge({ status }: { status: string }) {
  return <Badge color={COLORS[status as keyof typeof COLORS] ?? 'neutral'}>{status}</Badge>;
}
