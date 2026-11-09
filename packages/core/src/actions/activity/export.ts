import { activityLog, and, contacts, desc, eq, gte, lte } from '@app/db';
import { z } from 'zod';

import { toCsv } from '../../csv';
import { defineAction } from '../define';
import { instantField } from '../fields';

/** More than this many rows is cut off (`truncated: true`): export a shorter period. */
export const ACTIVITY_EXPORT_MAX_ROWS = 20_000;

export const exportActivityCsv = defineAction({
  name: 'activity.exportCsv',
  title: 'Export the activity log as CSV',
  description:
    'The audit trail as CSV text for a period (`from` / `to`) and optional filters — columns occurred_at, kind, ' +
    'action, actor_kind, actor, channel, subject_type, subject_id, summary, ok, error_code, error_ref, ip, ' +
    'request_id. Inputs are not included. Needs `data.export`; the export itself is logged. At most ' +
    `${ACTIVITY_EXPORT_MAX_ROWS.toLocaleString('en-US')} rows, newest first (\`truncated\` says when more matched).`,
  audience: 'data.export',
  mutates: true,
  returns: '{ filename, contentType: "text/csv", csv, rows, truncated }',
  input: z.object({
    from: instantField.optional(),
    to: instantField.optional(),
    kind: z.enum(['change', 'read', 'auth']).optional(),
    action: z.string().optional(),
    failedOnly: z.boolean().default(false),
  }),
  async run({ input, tx, log }) {
    const found = await tx
      .select({
        occurredAt: activityLog.occurredAt,
        kind: activityLog.kind,
        action: activityLog.action,
        actorKind: activityLog.actorKind,
        actor: contacts.displayName,
        channel: activityLog.channel,
        subjectType: activityLog.subjectType,
        subjectId: activityLog.subjectId,
        summary: activityLog.summary,
        ok: activityLog.ok,
        errorCode: activityLog.errorCode,
        errorRef: activityLog.errorRef,
        ip: activityLog.ip,
        requestId: activityLog.requestId,
      })
      .from(activityLog)
      .leftJoin(contacts, eq(contacts.id, activityLog.actorContactId))
      .where(
        and(
          input.from ? gte(activityLog.occurredAt, input.from) : undefined,
          input.to ? lte(activityLog.occurredAt, input.to) : undefined,
          input.kind ? eq(activityLog.kind, input.kind) : undefined,
          input.action ? eq(activityLog.action, input.action) : undefined,
          input.failedOnly ? eq(activityLog.ok, false) : undefined,
        ),
      )
      .orderBy(desc(activityLog.occurredAt))
      .limit(ACTIVITY_EXPORT_MAX_ROWS + 1);
    const truncated = found.length > ACTIVITY_EXPORT_MAX_ROWS;
    const rows = truncated ? found.slice(0, ACTIVITY_EXPORT_MAX_ROWS) : found;
    const csv = toCsv(
      [
        'occurred_at',
        'kind',
        'action',
        'actor_kind',
        'actor',
        'channel',
        'subject_type',
        'subject_id',
        'summary',
        'ok',
        'error_code',
        'error_ref',
        'ip',
        'request_id',
      ],
      rows.map((r) => [
        r.occurredAt,
        r.kind,
        r.action,
        r.actorKind,
        r.actor,
        r.channel,
        r.subjectType,
        r.subjectId,
        r.summary,
        r.ok ? 'yes' : 'no',
        r.errorCode,
        r.errorRef,
        r.ip,
        r.requestId,
      ]),
    );
    log({
      summary: `Exported ${rows.length} activity rows as CSV${truncated ? ' (cut off)' : ''}`,
    });
    return {
      filename: `activity-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: 'text/csv' as const,
      csv,
      rows: rows.length,
      truncated,
    };
  },
});
