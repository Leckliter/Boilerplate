import { Badge, type BadgeColor } from '@app/ui/components/badge';

/**
 * Status badges for the system's own records: one label and colour per status, in sentence case, so the
 * same state reads the same on every screen. Add yours here.
 */
type StatusMap = Record<string, readonly [BadgeColor, string]>;

const show = (map: StatusMap, status: string) => {
  const [color, label] = map[status] ?? (['neutral', status] as const);
  return <Badge color={color}>{label}</Badge>;
};

const JOB: StatusMap = {
  pending: ['amber', 'Waiting'],
  running: ['blue', 'Running'],
  done: ['green', 'Done'],
  failed: ['red', 'Failed'],
  cancelled: ['outline', 'Cancelled'],
};
/** A background job. */
export const JobStatusBadge = ({ status }: { status: string }) => show(JOB, status);

/** An error report: open until someone marks it fixed. */
export const ErrorStatusBadge = ({ resolved }: { resolved: boolean }) =>
  resolved ? <Badge color="green">Fixed</Badge> : <Badge color="red">Open</Badge>;

/** A contact: active or archived. */
export const ContactStatusBadge = ({ status }: { status: string }) =>
  status === 'archived' ? <Badge color="outline">Archived</Badge> : null;

const INQUIRY: StatusMap = {
  new: ['blue', 'New'],
  in_progress: ['amber', 'In progress'],
  resolved: ['green', 'Resolved'],
  spam: ['neutral', 'Spam'],
  archived: ['outline', 'Archived'],
};
/** A website inquiry's status. */
export const InquiryStatusBadge = ({ status }: { status: string }) => show(INQUIRY, status);
