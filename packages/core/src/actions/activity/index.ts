import {
  activityLog,
  and,
  apiKeys,
  changeLog,
  contacts,
  desc,
  eq,
  gte,
  ilike,
  lt,
  lte,
  ne,
  or,
} from '@app/db';
import { z } from 'zod';

import { ActionError, defineAction } from '../define';
import { instantField } from '../fields';

/** The columns every activity listing returns. */
const listColumns = {
  id: activityLog.id,
  occurredAt: activityLog.occurredAt,
  kind: activityLog.kind,
  action: activityLog.action,
  actorKind: activityLog.actorKind,
  actorContactId: activityLog.actorContactId,
  actorName: contacts.displayName,
  apiKeyId: activityLog.apiKeyId,
  apiKeyName: apiKeys.name,
  channel: activityLog.channel,
  subjectType: activityLog.subjectType,
  subjectId: activityLog.subjectId,
  summary: activityLog.summary,
  ok: activityLog.ok,
  error: activityLog.error,
  errorCode: activityLog.errorCode,
  errorRef: activityLog.errorRef,
  ip: activityLog.ip,
  requestId: activityLog.requestId,
  durationMs: activityLog.durationMs,
};

export const listActivity = defineAction({
  name: 'activity.list',
  title: 'List activity',
  description:
    'The audit trail, newest first: every change (successful or not), every sign-in/sign-out and password event, ' +
    'every denied attempt, and every API/MCP call including reads — who (person, API key/AI, system), which ' +
    'channel (web, api, mcp, system), from which IP, what, and whether it worked. Filter by subject to see one ' +
    'record’s history, by actor or API key to see what someone (or an AI) did. Narrow to a period with `from` / `to`. Page with `before` = the ' +
    'occurredAt of the last row. Use activity.get for one entry’s field-level changes.',
  audience: 'activity.read',
  mutates: false,
  returns: 'ActivityEntry[] with actorName and apiKeyName',
  input: z.object({
    subjectId: z.uuid().optional().describe('Only entries about this record, e.g. a contact id.'),
    actorContactId: z
      .uuid()
      .optional()
      .describe('Only entries by this person (including their API keys).'),
    apiKeyId: z.uuid().optional().describe('Only entries made with this API key.'),
    requestId: z.string().optional().describe('Only entries from one web/API request.'),
    action: z
      .string()
      .optional()
      .describe('Only this action name, e.g. "contacts.update" or "auth.signIn".'),
    kind: z
      .enum(['change', 'read', 'auth'])
      .optional()
      .describe('change, read (API/MCP reads) or auth.'),
    channel: z.enum(['web', 'api', 'mcp', 'system', 'cli', 'automation']).optional(),
    failedOnly: z
      .boolean()
      .default(false)
      .describe('Only failures (denied, invalid input, errors).'),
    q: z.string().trim().min(2).optional().describe('Search the summary and action name.'),
    before: instantField.optional().describe('Only entries older than this (for paging).'),
    from: instantField.optional().describe('Only entries at or after this moment (inclusive).'),
    to: instantField.optional().describe('Only entries at or before this moment (inclusive).'),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  async run({ input, tx }) {
    const filters = [
      input.from ? gte(activityLog.occurredAt, input.from) : undefined,
      input.to ? lte(activityLog.occurredAt, input.to) : undefined,
      input.subjectId ? eq(activityLog.subjectId, input.subjectId) : undefined,
      input.actorContactId ? eq(activityLog.actorContactId, input.actorContactId) : undefined,
      input.apiKeyId ? eq(activityLog.apiKeyId, input.apiKeyId) : undefined,
      input.requestId ? eq(activityLog.requestId, input.requestId) : undefined,
      input.action ? eq(activityLog.action, input.action) : undefined,
      input.kind ? eq(activityLog.kind, input.kind) : undefined,
      input.channel ? eq(activityLog.channel, input.channel) : undefined,
      input.failedOnly ? eq(activityLog.ok, false) : undefined,
      input.q
        ? or(ilike(activityLog.summary, `%${input.q}%`), ilike(activityLog.action, `%${input.q}%`))
        : undefined,
      input.before ? lt(activityLog.occurredAt, input.before) : undefined,
    ];
    return tx
      .select(listColumns)
      .from(activityLog)
      .leftJoin(contacts, eq(contacts.id, activityLog.actorContactId))
      .leftJoin(apiKeys, eq(apiKeys.id, activityLog.apiKeyId))
      .where(and(...filters))
      .orderBy(desc(activityLog.occurredAt))
      .limit(input.limit);
  },
});

export const getActivity = defineAction({
  name: 'activity.get',
  title: 'Get activity entry',
  description:
    'One audit entry in full: who, how, from where (IP, browser), the input, and every database row it ' +
    'changed with before → after values. Also lists the other entries from the same request.',
  audience: 'activity.read',
  mutates: false,
  returns: '{ entry, changes: ChangeEntry[], sameRequest: ActivityEntry[] }',
  input: z.object({ id: z.uuid() }),
  async run({ input, tx }) {
    const [entry] = await tx
      .select({ ...listColumns, input: activityLog.input, userAgent: activityLog.userAgent })
      .from(activityLog)
      .leftJoin(contacts, eq(contacts.id, activityLog.actorContactId))
      .leftJoin(apiKeys, eq(apiKeys.id, activityLog.apiKeyId))
      .where(eq(activityLog.id, input.id));
    if (!entry) throw new ActionError('not_found', 'No such activity entry.');
    const changes = await tx
      .select()
      .from(changeLog)
      .where(eq(changeLog.activityId, entry.id))
      .orderBy(changeLog.occurredAt);
    const sameRequest = entry.requestId
      ? await tx
          .select(listColumns)
          .from(activityLog)
          .leftJoin(contacts, eq(contacts.id, activityLog.actorContactId))
          .leftJoin(apiKeys, eq(apiKeys.id, activityLog.apiKeyId))
          .where(and(eq(activityLog.requestId, entry.requestId), ne(activityLog.id, entry.id)))
          .orderBy(activityLog.occurredAt)
          .limit(50)
      : [];
    return { entry, changes, sameRequest };
  },
});

export const listChanges = defineAction({
  name: 'activity.changes',
  title: 'Record history',
  description:
    'Field-level history of a record (a contact, product …): every insert, update and delete with before → ' +
    'after values, newest first, and who made it. Captured by the database itself, so it includes changes made ' +
    'outside the app (e.g. directly in the database) — those have no activityId and show the database user.',
  audience: 'activity.read',
  mutates: false,
  returns:
    '[{ id, occurredAt, tableName, rowId, op, before, after, dbUser, activityId, action, actorKind, actorName, apiKeyName, channel }]',
  input: z.object({
    subjectId: z.uuid().describe('The record, e.g. a contact id or product id.'),
    before: instantField.optional().describe('Only changes older than this (for paging).'),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  async run({ input, tx }) {
    return tx
      .select({
        id: changeLog.id,
        occurredAt: changeLog.occurredAt,
        tableName: changeLog.tableName,
        rowId: changeLog.rowId,
        op: changeLog.op,
        before: changeLog.before,
        after: changeLog.after,
        dbUser: changeLog.dbUser,
        activityId: changeLog.activityId,
        action: activityLog.action,
        actorKind: activityLog.actorKind,
        actorName: contacts.displayName,
        apiKeyName: apiKeys.name,
        channel: activityLog.channel,
      })
      .from(changeLog)
      .leftJoin(activityLog, eq(activityLog.id, changeLog.activityId))
      .leftJoin(contacts, eq(contacts.id, activityLog.actorContactId))
      .leftJoin(apiKeys, eq(apiKeys.id, activityLog.apiKeyId))
      .where(
        and(
          eq(changeLog.subjectId, input.subjectId),
          input.before ? lt(changeLog.occurredAt, input.before) : undefined,
        ),
      )
      .orderBy(desc(changeLog.occurredAt))
      .limit(input.limit);
  },
});
