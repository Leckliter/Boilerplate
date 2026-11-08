import {
  activityLog,
  and,
  apiKeys,
  contacts,
  desc,
  eq,
  errorEvents,
  type ErrorEvent,
  gte,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from '@app/db';
import { z } from 'zod';

import { ActionError, defineAction } from '../define';

const REF = z
  .string()
  .trim()
  .min(4)
  .describe('The error reference people see, e.g. "E-7K3QX9MD" (or a Next.js error digest).');

export const listErrors = defineAction({
  name: 'errors.list',
  title: 'List errors',
  description:
    'Unexpected failures (bugs and outages), grouped: occurrences of the same bug share a fingerprint and are ' +
    'listed once with a count. Each group shows its newest reference — pass that to errors.get for the full ' +
    'report (stack, input, diagnosis). Open = at least one occurrence not marked fixed.',
  audience: 'errors.manage',
  mutates: false,
  returns:
    '[{ fingerprint, ref, code, message, source, action, path, count, openCount, firstSeen, lastSeen, resolution }]',
  input: z.object({
    status: z.enum(['open', 'resolved', 'all']).default('open'),
    sinceDays: z
      .number()
      .int()
      .min(1)
      .max(365)
      .default(30)
      .describe('Only errors seen in this window.'),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  async run({ input, tx }) {
    const since = new Date(Date.now() - input.sinceDays * 86_400_000);
    const openCount = sql<number>`count(*) filter (where ${errorEvents.resolvedAt} is null)::int`;
    const groups = await tx
      .select({
        fingerprint: errorEvents.fingerprint,
        count: sql<number>`count(*)::int`,
        openCount,
        firstSeen: sql`min(${errorEvents.occurredAt})`.mapWith(errorEvents.occurredAt),
        lastSeen: sql`max(${errorEvents.occurredAt})`.mapWith(errorEvents.occurredAt),
      })
      .from(errorEvents)
      .where(gte(errorEvents.occurredAt, since))
      .groupBy(errorEvents.fingerprint)
      .having(
        input.status === 'open'
          ? sql`${openCount} > 0`
          : input.status === 'resolved'
            ? sql`${openCount} = 0`
            : undefined,
      )
      .orderBy(desc(sql`max(${errorEvents.occurredAt})`))
      .limit(input.limit);
    if (groups.length === 0) return [];

    const latest = await tx
      .selectDistinctOn([errorEvents.fingerprint])
      .from(errorEvents)
      .where(
        inArray(
          errorEvents.fingerprint,
          groups.map((g) => g.fingerprint),
        ),
      )
      .orderBy(errorEvents.fingerprint, desc(errorEvents.occurredAt));
    const byFingerprint = new Map(latest.map((e) => [e.fingerprint, e]));
    return groups.map((g) => {
      const e = byFingerprint.get(g.fingerprint)!;
      return {
        ...g,
        ref: e.ref,
        code: e.code,
        message: e.message,
        source: e.source,
        action: e.action,
        path: e.path,
        environment: e.environment,
        resolution: e.resolution,
      };
    });
  },
});

export const getError = defineAction({
  name: 'errors.get',
  title: 'Get error report',
  description:
    'Everything known about one error, for fixing it: the diagnosis (code + hint), message, stack trace, cause ' +
    'chain, the action and its input (secrets redacted), who hit it and where, the deployed commit, how often ' +
    'the same bug has happened, and what else happened in the same request. `brief` is all of that as one ' +
    'Markdown document — start there. After fixing, call errors.resolve.',
  audience: 'errors.manage',
  mutates: false,
  returns: '{ error, actorName, apiKeyName, occurrences, recentRefs, relatedActivity, brief }',
  input: z.object({ ref: REF }),
  async run({ input, tx }) {
    const ref = input.ref.toUpperCase().startsWith('E-') ? input.ref.toUpperCase() : input.ref;
    const [found] = await tx
      .select({ error: errorEvents, actorName: contacts.displayName, apiKeyName: apiKeys.name })
      .from(errorEvents)
      .leftJoin(contacts, eq(contacts.id, errorEvents.actorContactId))
      .leftJoin(apiKeys, eq(apiKeys.id, errorEvents.apiKeyId))
      .where(or(eq(errorEvents.ref, ref), eq(errorEvents.digest, input.ref)))
      .orderBy(desc(errorEvents.occurredAt))
      .limit(1);
    if (!found) {
      throw new ActionError(
        'not_found',
        `No error report "${input.ref}". It may be from the other environment (production vs test), ` +
          'or the database was unreachable when it happened — then search the server logs (Vercel → Logs) for the reference.',
      );
    }
    const { error } = found;

    const [occurrences] = await tx
      .select({
        count: sql<number>`count(*)::int`,
        openCount: sql<number>`count(*) filter (where ${errorEvents.resolvedAt} is null)::int`,
        firstSeen: sql`min(${errorEvents.occurredAt})`.mapWith(errorEvents.occurredAt),
        lastSeen: sql`max(${errorEvents.occurredAt})`.mapWith(errorEvents.occurredAt),
        releases: sql<string[]>`array_remove(array_agg(distinct ${errorEvents.release}), null)`,
      })
      .from(errorEvents)
      .where(eq(errorEvents.fingerprint, error.fingerprint));

    const recentRefs = (
      await tx
        .select({ ref: errorEvents.ref })
        .from(errorEvents)
        .where(and(eq(errorEvents.fingerprint, error.fingerprint), ne(errorEvents.id, error.id)))
        .orderBy(desc(errorEvents.occurredAt))
        .limit(5)
    ).map((r) => r.ref);

    const relatedActivity = error.requestId
      ? await tx
          .select({
            occurredAt: activityLog.occurredAt,
            action: activityLog.action,
            ok: activityLog.ok,
            summary: activityLog.summary,
            error: activityLog.error,
          })
          .from(activityLog)
          .where(eq(activityLog.requestId, error.requestId))
          .orderBy(activityLog.occurredAt)
          .limit(20)
      : [];

    const result = {
      error,
      actorName: found.actorName,
      apiKeyName: found.apiKeyName,
      occurrences: occurrences!,
      recentRefs,
      relatedActivity,
    };
    return { ...result, brief: errorBrief(result) };
  },
});

export const resolveError = defineAction({
  name: 'errors.resolve',
  title: 'Mark error fixed',
  description:
    'Mark a bug fixed: every open occurrence with the same fingerprint as this reference is closed with your ' +
    'note. Say what fixed it (commit, PR link). If the bug happens again it shows up as open again.',
  audience: 'errors.manage',
  mutates: true,
  returns: '{ resolved: number }',
  input: z.object({
    ref: REF,
    resolution: z
      .string()
      .trim()
      .min(3)
      .max(2_000)
      .describe('What fixed it, e.g. "Fixed in a1b2c3d — null check in contacts.update (PR #42)".'),
  }),
  async run({ input, actor, tx, log }) {
    const [error] = await tx
      .select({ id: errorEvents.id, fingerprint: errorEvents.fingerprint, ref: errorEvents.ref })
      .from(errorEvents)
      .where(or(eq(errorEvents.ref, input.ref.toUpperCase()), eq(errorEvents.digest, input.ref)))
      .limit(1);
    if (!error) throw new ActionError('not_found', `No error report "${input.ref}".`);
    const resolved = await tx
      .update(errorEvents)
      .set({ resolvedAt: new Date(), resolvedBy: actor.contactId, resolution: input.resolution })
      .where(and(eq(errorEvents.fingerprint, error.fingerprint), isNull(errorEvents.resolvedAt)))
      .returning({ id: errorEvents.id });
    log({
      subjectType: 'error',
      subjectId: error.id,
      summary: `Marked ${error.ref} fixed (${resolved.length} occurrence${resolved.length === 1 ? '' : 's'}): ${input.resolution}`,
    });
    return { resolved: resolved.length };
  },
});

type BriefInput = {
  error: ErrorEvent;
  actorName: string | null;
  apiKeyName: string | null;
  occurrences: {
    count: number;
    openCount: number;
    firstSeen: Date;
    lastSeen: Date;
    releases: string[];
  };
  recentRefs: string[];
  relatedActivity: {
    occurredAt: Date;
    action: string;
    ok: boolean;
    summary: string | null;
    error: string | null;
  }[];
};

/** The whole report as one Markdown document — what to paste into (or fetch from) an AI agent. */
export function errorBrief(r: BriefInput): string {
  const e = r.error;
  const json = (v: unknown) => '```json\n' + JSON.stringify(v, null, 2) + '\n```';
  const who =
    e.actorKind === 'api_key'
      ? `API key "${r.apiKeyName ?? e.apiKeyId}" (owner: ${r.actorName ?? e.actorContactId})`
      : e.actorKind === 'user'
        ? `${r.actorName ?? 'a user'} (contact ${e.actorContactId})`
        : (e.actorKind ?? 'unknown');
  const lines = [
    `# Error ${e.ref} — ${e.code}`,
    '',
    `- **When:** ${e.occurredAt.toISOString()} · **Environment:** ${e.environment} · **Commit:** ${e.release ?? 'unknown (local?)'}`,
    `- **Where:** ${e.source}${e.action ? ` · action \`${e.action}\`` : ''}${e.path ? ` · ${e.method ?? ''} ${e.path}`.trimEnd() : ''}${e.channel ? ` · channel ${e.channel}` : ''}`,
    `- **Who:** ${who}`,
    `- **Seen:** ${r.occurrences.count}× (${r.occurrences.openCount} open) between ${r.occurrences.firstSeen.toISOString()} and ${r.occurrences.lastSeen.toISOString()}` +
      (r.occurrences.releases.length
        ? ` · in commits ${r.occurrences.releases.map((s) => s.slice(0, 7)).join(', ')}`
        : ''),
    e.resolvedAt ? `- **Marked fixed:** ${e.resolvedAt.toISOString()} — ${e.resolution}` : '',
    '',
    '## Message',
    '',
    `${e.errorName ? `${e.errorName}: ` : ''}${e.message}`,
    '',
    '## Diagnosis',
    '',
    `\`${e.code}\` — ${e.hint ?? ''}`,
    '',
  ];
  if (e.stack) lines.push('## Stack', '', '```', e.stack, '```', '');
  if (Array.isArray(e.causes) && e.causes.length)
    lines.push('## Caused by', '', json(e.causes), '');
  if (e.input !== null) lines.push('## Input (secrets redacted)', '', json(e.input), '');
  if (e.context) lines.push('## Context', '', json(e.context), '');
  if (r.relatedActivity.length) {
    lines.push('## Same request', '');
    for (const a of r.relatedActivity) {
      lines.push(
        `- ${a.occurredAt.toISOString()} \`${a.action}\` ${a.ok ? 'ok' : 'FAILED'} — ${a.summary ?? a.error ?? ''}`,
      );
    }
    lines.push('');
  }
  if (r.recentRefs.length) lines.push(`Other occurrences: ${r.recentRefs.join(', ')}`, '');
  lines.push(
    '## Fixing it',
    '',
    `1. Read the code as it was deployed: \`git show ${e.release ? e.release.slice(0, 12) : 'HEAD'}:<file>\` — the stack's first frame in \`packages/\` or \`apps/web/\` is the place to start (deployed stacks may point into \`.next/\` bundles; use the action name / route to find the source).`,
    '2. Reproduce it with a test in `packages/core/test` using the input above (`pnpm test`; see docs/testing.md).',
    '3. Fix the cause (not the symptom), run `pnpm check`, commit and push.',
    `4. Mark it fixed: \`errors.resolve\` with \`{ "ref": "${e.ref}", "resolution": "<commit / PR>" }\`.`,
    '',
    `Re-fetch this report any time: \`curl -s -X POST "$APP_URL/api/v1/actions/errors.get" -H "Authorization: Bearer $APP_API_KEY" -H "Content-Type: application/json" -d '{"ref":"${e.ref}"}'\` (APP_URL = this environment's site, APP_API_KEY = an owner/admin API key), or the \`errors_get\` MCP tool.`,
    '',
    'See docs/errors.md for how error reports work.',
  );
  return lines.filter((l, i, all) => !(l === '' && all[i - 1] === '')).join('\n');
}
