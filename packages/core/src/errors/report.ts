import { randomInt } from 'node:crypto';

import { and, count, eq, errorEvents, getDb, gt, isNull, ne } from '@app/db';

import type { Actor, RequestInfo } from '../access';
import { getAppEnv } from '../env';
import { redact } from '../redact';
import { chain, diagnose } from './diagnose';
import { fingerprint } from './fingerprint';
import { errorAlertHandlers, type ErrorAlert } from './alerts';

type ErrorSource = (typeof errorEvents.$inferInsert)['source'];

export type ErrorReport = {
  source: ErrorSource;
  /** The action that was running, e.g. `contacts.update`. */
  action?: string;
  actor?: Actor;
  /** The action input or request body (secrets are redacted before saving). */
  input?: unknown;
  /** Defaults to `actor.request`. */
  request?: Partial<RequestInfo>;
  method?: string;
  /** Next.js error digest (server render errors). */
  digest?: string;
  /** Anything else useful for whoever fixes it. */
  context?: Record<string, unknown>;
};

const REF_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'; // no 0/O, 1/I/L, U

/** A short reference people can read out or paste, e.g. `E-7K3QX9MD`. */
export function newErrorRef(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `E-${s}`;
}

/**
 * Record an unexpected failure and return its reference (e.g. `E-7K3QX9MD`)
 * to show the person who hit it. Never throws: if the database itself is
 * down, the full report still goes to the server log (Vercel → Logs; search
 * for the reference).
 *
 * Call it from catch blocks that would otherwise swallow a bug. Actions don't
 * need to — `runAction` reports anything they throw that isn't an ActionError.
 */
export async function reportError(err: unknown, report: ErrorReport): Promise<string> {
  const ref = newErrorRef();
  let row: typeof errorEvents.$inferInsert | undefined;
  try {
    row = buildRow(ref, err, report);
    await getDb()
      .insert(errorEvents)
      .values(row)
      // Something in the details couldn't be stored (e.g. a \u0000 in the input): keep the essentials.
      .catch(() =>
        getDb()
          .insert(errorEvents)
          .values({
            ...row!,
            message: clean(row!.message),
            stack: row!.stack && clean(row!.stack),
            causes: null,
            input: null,
            context: { note: 'details could not be stored; see the server log' },
          }),
      );
  } catch (saveError) {
    // The error reporter can't report itself: the server log (searchable by ref) is the fallback.
    console.error(
      `[error ${ref}] could not save error report`,
      JSON.stringify({ report: row ?? { message: String(err) }, saveError: String(saveError) }),
    );
    return ref;
  }
  console.error(`[error ${ref}] ${row.code}: ${row.message}`, err);
  await alertStaff(row);
  return ref;
}

function buildRow(ref: string, err: unknown, report: ErrorReport) {
  const [top] = chain(err);
  const diagnosis = diagnose(err);
  const name = err instanceof Error ? err.name : typeof err;
  const message = clip(top?.message ?? String(err), 2_000) || '(no message)';
  const stack = err instanceof Error && err.stack ? clip(err.stack, 20_000) : null;
  const request = { ...report.actor?.request, ...report.request };
  return {
    ref,
    source: report.source,
    code: diagnosis.code,
    hint: diagnosis.hint,
    fingerprint: fingerprint(diagnosis.code, name, message, stack, report.action),
    errorName: name,
    message,
    stack,
    causes: chain(err)
      .slice(1)
      .map((c) => redact(pick(c))),
    environment: getAppEnv(),
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? null,
    action: report.action ?? null,
    path: request.path ?? null,
    method: report.method ?? null,
    digest: report.digest ?? null,
    requestId: request.id ?? null,
    actorKind: report.actor?.kind ?? null,
    actorContactId: report.actor?.contactId ?? null,
    apiKeyId: report.actor?.apiKeyId ?? null,
    channel: report.actor?.channel ?? null,
    input: report.input === undefined ? null : redact(report.input),
    context: redact({
      ...pick(top ?? {}),
      ...report.context,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
      region: process.env.VERCEL_REGION,
    }),
    ip: request.ip ?? null,
    userAgent: request.userAgent ? clip(request.userAgent, 500) : null,
  } satisfies typeof errorEvents.$inferInsert;
}

/** Fields worth keeping from an error object (Postgres, Stripe and Node errors carry extras). */
function pick(e: object): Record<string, unknown> {
  const keep = [
    'name',
    'message',
    'code',
    'type',
    'param',
    'detail',
    'hint',
    'column_name',
    'table_name',
    'constraint_name',
    'statusCode',
    'requestId',
    'errno',
  ];
  const src = e as Record<string, unknown>;
  return Object.fromEntries(
    keep.filter((k) => src[k] !== undefined && src[k] !== null).map((k) => [k, src[k]]),
  );
}

const clean = (s: string) => s.split(String.fromCharCode(0)).join('');
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** A spike = this many occurrences of one open bug within SPIKE_MINUTES. */
export const SPIKE_THRESHOLD = 10;
export const SPIKE_MINUTES = 15;

/**
 * Work out whether a new report is worth telling someone about, and hand that to the alert
 * handlers (registerErrorAlerts, errors/alerts.ts — the notifications module registers one that
 * notifies everyone with `errors.manage`):
 * - a NEW bug: the first occurrence of a fingerprint, or the first since it was marked fixed;
 * - a SPIKE: SPIKE_THRESHOLD occurrences of an open bug within SPIKE_MINUTES (at most once per
 *   bug per hour — handlers should dedupe on `alert.dedupeKey`).
 * Other repeats only raise the count on Admin → Errors. Without handlers this does nothing.
 */
async function alertStaff(row: typeof errorEvents.$inferInsert) {
  if (errorAlertHandlers.length === 0) return;
  try {
    await getDb().transaction(async (tx) => {
      const base = {
        ref: row.ref,
        code: row.code,
        message: row.message,
        where: row.action ?? row.path ?? row.source,
        environment: row.environment,
      };
      const [open] = await tx
        .select({ id: errorEvents.id })
        .from(errorEvents)
        .where(
          and(
            eq(errorEvents.fingerprint, row.fingerprint),
            isNull(errorEvents.resolvedAt),
            ne(errorEvents.ref, row.ref),
          ),
        )
        .limit(1);
      let alert: ErrorAlert | null = null;
      if (!open) {
        alert = { kind: 'new', ...base, dedupeKey: row.ref };
      } else {
        const since = new Date(Date.now() - SPIKE_MINUTES * 60_000);
        const [recent] = await tx
          .select({ n: count() })
          .from(errorEvents)
          .where(
            and(
              eq(errorEvents.fingerprint, row.fingerprint),
              isNull(errorEvents.resolvedAt),
              gt(errorEvents.occurredAt, since),
            ),
          );
        const n = recent?.n ?? 0;
        if (n >= SPIKE_THRESHOLD) {
          const hour = new Date().toISOString().slice(0, 13); // e.g. 2026-10-29T14
          alert = {
            kind: 'spike',
            ...base,
            count: n,
            minutes: SPIKE_MINUTES,
            dedupeKey: `spike:${row.fingerprint}:${hour}`,
          };
        }
      }
      if (!alert) return;
      for (const handler of errorAlertHandlers) await handler(tx, alert);
    });
  } catch (e) {
    // Never let alerting about an error cause another one.
    console.error(`[error ${row.ref}] could not alert`, e);
  }
}
