import { randomUUID } from 'node:crypto';
import { watched } from '../watchdog';

import { getDb, sql } from '@app/db';
import { z } from 'zod';

import { type Actor, hasPermission } from '../access';
import { type ActivityRow, actorColumns, recordActivity } from '../activity';
import { reportError } from '../errors/report';
import { humanCheckEnabled, verifyHuman } from '../human-check';
import {
  claimIdempotencyKey,
  idempotencyClaim,
  isValidIdempotencyKey,
  saveIdempotentResponse,
} from '../idempotency';
import { rateLimitCaller, takeRateLimit } from '../rate-limit';
import {
  ActionError,
  type ActionErrorCode,
  DEFAULT_STATEMENT_TIMEOUT_MS,
  type ActionResult,
  type AnyAction,
  type ActionDefinition,
} from './define';
import { getAction } from './registry';

type LogEntry = { subjectType?: string; subjectId?: string; summary: string };
type Failure = { code: ActionErrorCode; message: string; details?: unknown; ref?: string };

/** Run an action by name with untrusted input (REST API, MCP, forms). */
export async function runAction(
  name: string,
  rawInput: unknown,
  actor: Actor,
): Promise<ActionResult<unknown>> {
  const action = getAction(name);
  if (!action) {
    return { ok: false, error: { code: 'unknown_action', message: `No action named "${name}".` } };
  }
  return execute(action, rawInput, actor);
}

/** Run an action from server code with a typed input. */
export async function callAction<S extends z.ZodType, O, R = O>(
  action: ActionDefinition<S, O, R>,
  input: z.input<S>,
  actor: Actor,
): Promise<ActionResult<R>> {
  return execute(action as unknown as AnyAction, input, actor) as Promise<ActionResult<R>>;
}

/** Test-only: sees every action outcome (packages/core/test/action-coverage.ts). */
type ActionRecorder = (name: string, result: ActionResult<unknown>) => void;
let recorder: ActionRecorder | null = null;
export function recordActionsForTests(fn: ActionRecorder | null) {
  recorder = fn;
}

async function execute(
  action: AnyAction,
  rawInput: unknown,
  actor: Actor,
): Promise<ActionResult<unknown>> {
  const result = await watched(`action ${action.name} (${actor.channel})`, () =>
    executeAction(action, rawInput, actor),
  );
  recorder?.(action.name, result);
  return result;
}

/**
 * What gets an activity-log row:
 * - every change, whether it worked or not
 * - every read by an API key (REST or MCP) — what an AI looked at matters too
 * - every denied attempt by someone signed in or holding a key
 * Reads by people browsing the apps are not logged (they'd drown everything else).
 */
async function executeAction(
  action: AnyAction,
  rawInput: unknown,
  actor: Actor,
): Promise<ActionResult<unknown>> {
  const started = Date.now();
  const activityId = randomUUID();
  const logged = action.mutates || actor.kind === 'api_key';
  const row = (fields: Partial<ActivityRow> & { ok: boolean }): ActivityRow => ({
    id: activityId,
    kind: action.mutates ? 'change' : 'read',
    action: action.name,
    ...actorColumns(actor),
    durationMs: Date.now() - started,
    ...fields,
  });
  const fail = async (
    error: Failure,
    input: unknown,
    entry?: LogEntry,
    id?: string,
  ): Promise<ActionResult<unknown>> => {
    await recordActivity(
      row({
        ...(id && { id }),
        ok: false,
        input,
        ...subject(entry),
        error: error.message.slice(0, 1_000),
        errorCode: error.code,
        errorRef: error.ref ?? null,
      }),
    );
    return { ok: false, error };
  };

  // A key limited to specific permissions must not make "any signed-in user" changes either.
  const restrictedChange =
    actor.restricted && action.audience === 'authenticated' && action.mutates;
  if (restrictedChange || !hasPermission(actor, action.audience)) {
    if (actor.kind === 'guest') {
      return { ok: false, error: { code: 'unauthenticated', message: 'Sign in to do this.' } };
    }
    return fail(
      { code: 'forbidden', message: `You don't have permission for ${action.name}.` },
      unvalidated(action, rawInput),
    );
  }

  if (action.rateLimit) {
    const caller = rateLimitCaller(actor);
    const verdict = caller
      ? await takeRateLimit(`${action.name}|${caller}`, action.rateLimit).catch(async (err) => {
          // A broken counter must not take the action down with it.
          await reportError(err, { source: 'action', action: action.name, actor });
          return { allowed: true as const };
        })
      : { allowed: true as const };
    if (!verdict.allowed) {
      const error: Failure = {
        code: 'rate_limited',
        message: `Too many tries — please wait ${waitText(verdict.retryAfterSeconds)} and try again.`,
        details: { retryAfterSeconds: verdict.retryAfterSeconds },
      };
      return actor.kind === 'guest'
        ? { ok: false, error }
        : fail(error, unvalidated(action, rawInput));
    }
  }

  if (action.humanCheck && actor.kind === 'guest' && humanCheckEnabled()) {
    const token = actor.request?.humanToken;
    let human = false;
    if (token) {
      try {
        human = await verifyHuman(token, actor.request?.ip ?? null);
      } catch (err) {
        // Cloudflare is down or misconfigured: let people through rather than lock everyone out.
        await reportError(err, { source: 'action', action: action.name, actor });
        human = true;
      }
    }
    if (!human) {
      return {
        ok: false,
        error: {
          code: 'forbidden',
          message: 'Please complete the “I’m human” check and try again.',
        },
      };
    }
  }

  const parsed = action.input.safeParse(rawInput ?? {});
  if (!parsed.success) {
    const error: Failure = {
      code: 'invalid_input',
      message: z.prettifyError(parsed.error),
      details: z.flattenError(parsed.error),
    };
    return logged && actor.kind !== 'guest'
      ? fail(error, unvalidated(action, rawInput))
      : { ok: false, error };
  }
  const input = action.logInput ? safeLogInput(action, parsed.data) : parsed.data;

  const sentKey = actor.request?.idempotencyKey;
  if (action.mutates && sentKey && !isValidIdempotencyKey(sentKey)) {
    return {
      ok: false,
      error: {
        code: 'invalid_input',
        message: 'Idempotency-Key must be 1–255 visible characters (a UUID works well).',
      },
    };
  }
  const idempotency = action.mutates ? idempotencyClaim(actor, action.name, parsed.data) : null;

  let entry: LogEntry | undefined;
  let committed = false;
  try {
    const data = await getDb().transaction(async (tx) => {
      if (idempotency) {
        // Waits here if a request with the same key is still running.
        const claim = await claimIdempotencyKey(tx, idempotency);
        if (claim.kind !== 'claimed') throw new IdempotentOutcome(claim);
      }
      // Bound every statement of this transaction (local to it, so it also works through
      // a pooled connection and never leaks to the next request on the connection).
      await tx.execute(
        sql`select set_config('statement_timeout', ${String(action.statementTimeoutMs ?? DEFAULT_STATEMENT_TIMEOUT_MS)}, true)`,
      );
      // Lets the change-tracking trigger link every row this transaction touches to this entry.
      if (action.mutates) {
        await tx.execute(sql`select set_config('app.activity_id', ${activityId}, true)`);
        // Events this change emits are marked as caused by the automation run (loop protection).
        if (actor.automation) {
          await tx.execute(
            sql`select set_config('app.automation_cause', ${JSON.stringify(actor.automation)}, true)`,
          );
        }
      }
      const result = await action.run({
        input: parsed.data,
        actor,
        tx,
        log: (e) => {
          entry = e;
        },
      });
      if (logged && !(action.logOnlyWhenChanged && !entry)) {
        await recordActivity(row({ ok: true, input, ...subject(entry) }), tx);
      }
      if (idempotency && !action.afterCommit) await saveIdempotentResponse(tx, idempotency, result);
      return result;
    });
    committed = true;
    if (action.afterCommit) {
      const final = await action.afterCommit({ result: data, actor });
      if (idempotency) await saveIdempotentResponse(getDb(), idempotency, final);
      return { ok: true, data: final };
    }
    return { ok: true, data };
  } catch (err) {
    if (err instanceof IdempotentOutcome) return err.result();
    let error: Failure;
    if (err instanceof ActionError && err.code !== 'internal') {
      error = { code: err.code, message: err.message, details: err.details };
    } else if (isUniqueViolation(err)) {
      error = {
        code: 'conflict',
        message: 'That already exists (someone may have just created it).',
      };
    } else {
      const ref = await reportError(err, {
        source: 'action',
        action: action.name,
        actor,
        input: parsed.data,
      });
      // An ActionError('internal', …) carries a message meant for people (e.g. "The payment provider rejected …").
      const said =
        err instanceof ActionError ? err.message.replace(/\.?$/, '.') : 'Something went wrong.';
      error = { code: 'internal', message: `${said} Error reference: ${ref}`, ref };
    }
    if (!logged) return { ok: false, error };
    // afterCommit failed: the change itself was saved and logged; log the failure as its own entry.
    return fail(error, input, entry, committed ? randomUUID() : undefined);
  }
}

/** Thrown out of the transaction when the Idempotency-Key was already used (nothing is written). */
class IdempotentOutcome extends Error {
  constructor(
    private readonly outcome: Exclude<
      Awaited<ReturnType<typeof claimIdempotencyKey>>,
      { kind: 'claimed' }
    >,
  ) {
    super('idempotent outcome');
  }
  result(): ActionResult<unknown> {
    switch (this.outcome.kind) {
      case 'replay':
        return { ok: true, data: this.outcome.response, replayed: true };
      case 'mismatch':
        return {
          ok: false,
          error: {
            code: 'conflict',
            message:
              'This Idempotency-Key was already used for a different request. Use a new key for a new change.',
          },
        };
      case 'in_progress':
        return {
          ok: false,
          error: {
            code: 'conflict',
            message:
              'A request with this Idempotency-Key is still finishing. Wait a moment and send it again.',
            details: { retryAfterSeconds: 2 },
          },
        };
    }
  }
}

function waitText(seconds: number) {
  const [n, unit] =
    seconds < 60
      ? [seconds, 'second']
      : seconds < 3600
        ? [Math.ceil(seconds / 60), 'minute']
        : [Math.ceil(seconds / 3600), 'hour'];
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

const subject = (entry: LogEntry | undefined) => ({
  subjectType: entry?.subjectType ?? null,
  subjectId: entry?.subjectId ?? null,
  summary: entry?.summary ?? null,
});

/** Input that failed validation. Actions that choose what to log (logInput) keep raw input out entirely. */
const unvalidated = (action: AnyAction, raw: unknown) =>
  action.logInput ? '[not logged for this action]' : raw;

function safeLogInput(action: AnyAction, input: unknown) {
  try {
    return action.logInput!(input);
  } catch {
    // Choosing what to log must never fail the action itself.
    return '[unavailable]';
  }
}

/** Postgres unique_violation (23505), possibly wrapped by the driver. */
function isUniqueViolation(err: unknown): boolean {
  for (let e = err as { code?: string; cause?: unknown } | undefined; e; e = e.cause as typeof e) {
    if (e.code === '23505') return true;
  }
  return false;
}
