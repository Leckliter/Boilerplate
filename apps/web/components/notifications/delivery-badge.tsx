import { Badge } from '@app/ui/components/badge';

const COLORS = {
  pending: 'amber',
  sending: 'blue',
  sent: 'green',
  delivered: 'green',
  failed: 'red',
  skipped: 'neutral',
} as const;

/** The status of one delivery (pending, sent, failed, skipped …). */
export function DeliveryBadge({ status }: { status: string }) {
  const color = COLORS[status as keyof typeof COLORS] ?? 'neutral';
  return <Badge color={color}>{status}</Badge>;
}
