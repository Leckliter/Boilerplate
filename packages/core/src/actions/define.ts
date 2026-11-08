import type { Tx } from '@app/db';
import type { z } from 'zod';

import type { Actor, Audience } from '../access';
import type { RateLimit } from '../rate-limit';

/**
 * An ACTION is the one and only way to read or change business data.
 *
 * The admin app, the POS, the customer portal, the REST API and the MCP server
 * (AI) all call the same actions. So every rule — validation, permissions,
 * activity logging — is written once and applies everywhere.
 *
 * Naming: `<area>.<verb>` in camelCase, e.g. `contacts.create`,
 * `contacts.addTags`, `rentals.extend`. The area groups related actions;
 * the verb says what happens.
 *
 * See docs/actions.md for how to add one.
 */
export type ActionDefinition<S extends z.ZodType = z.ZodType, O = unknown, R = O> = {
  /** `<area>.<verb>`, e.g. `contacts.create`. Unique. Never rename once shipped (API + AI use it). */
  name: `${string}.${string}`;
  /** Short human label, e.g. "Create contact". */
  title: string;
  /**
   * What it does, when to use it, and anything surprising. Written for an AI
   * reader: this text becomes the MCP tool description and the API docs.
   */
  description: string;
  /** Who may run it: a permission, `authenticated` (any signed-in contact) or `public`. */
  audience: Audience;
  /** Zod schema for the input. Use `.describe()` on fields — it ends up in the docs. */
  input: S;
  /**
   * true when it changes data. Mutating actions are written to the activity log
   * (and every row they touch to the change log); reads are logged only when an
   * API key / AI runs them.
   */
  mutates: boolean;
  /** true when it removes or revokes something (hint for AI clients to confirm first). */
  destructive?: boolean;
  /** What to store as `input` in the activity log (default: the validated input, redacted). */
  logInput?: (input: z.output<S>) => unknown;
  /** Only write an activity row when the action called `log()` (for high-volume no-op events). */
  logOnlyWhenChanged?: boolean;
  /**
   * Cap how often one caller (person, API key, or a guest's IP address) may run
   * this, e.g. `{ limit: 5, perSeconds: 600 }`. Over the cap → `rate_limited`.
   * Use it on public actions that write or cost money. The system is never limited.
   */
  rateLimit?: RateLimit;
  /**
   * Guests must pass the "are you a person?" check (Cloudflare Turnstile) —
   * only while it's configured (see human-check.ts). For public forms bots love.
   */
  humanCheck?: boolean;
  /** One line describing what comes back. */
  returns: string;
  /**
   * The longest any single database statement of this action may run, in milliseconds
   * (default 30 000, see `DEFAULT_STATEMENT_TIMEOUT_MS`). A query or lock wait that goes past it is
   * cancelled and reported as an error instead of holding the request (and one of Vercel's few
   * database connections) until the platform's 300 s limit. Raise it only for an action that
   * really runs one long statement.
   */
  statementTimeoutMs?: number;
  run: (ctx: ActionContext<z.output<S>>) => Promise<O>;
  /**
   * Optional second step that runs AFTER the transaction has committed — for
   * calls to outside services that must only happen once our data is safely
   * saved (e.g. creating a hosted payment page for a saved record). Its return
   * value replaces `run`'s. If it throws, the saved data stays.
   */
  afterCommit?: (ctx: { result: O; actor: Actor }) => Promise<R>;
};

/** Default for `ActionDefinition.statementTimeoutMs`. Interactive pages answer in well under a second. */
export const DEFAULT_STATEMENT_TIMEOUT_MS = 30_000;

export type ActionContext<I> = {
  input: I;
  actor: Actor;
  /** Database transaction. Everything the action writes commits or rolls back together. */
  tx: Tx;
  /** Describe what happened for the activity log (mutating actions should call this). */
  log: (entry: { subjectType?: string; subjectId?: string; summary: string }) => void;
};

export type AnyAction = ActionDefinition<z.ZodType, unknown, unknown>;

export function defineAction<S extends z.ZodType, O, R = O>(def: ActionDefinition<S, O, R>) {
  return def;
}

export type ActionErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid_input'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'unknown_action'
  | 'internal';

/**
 * Throw this from an action for an expected failure the caller should see.
 * Use code `internal` (with the original error as `cause`) for a failure that
 * is a bug or an outage but whose message should still reach the person —
 * it is reported like any unexpected error and gets an error reference.
 */
export class ActionError extends Error {
  constructor(
    public readonly code: ActionErrorCode,
    message: string,
    public readonly details?: unknown,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ActionError';
  }
}

export type ActionResult<O> =
  | {
      ok: true;
      data: O;
      /** The same Idempotency-Key was used before: this is the first call's result, nothing was done again. */
      replayed?: true;
    }
  | {
      ok: false;
      error: {
        code: ActionErrorCode;
        message: string;
        details?: unknown;
        /** For `internal` errors: the error report reference, e.g. `E-7K3QX9MD` (see errors.get). */
        ref?: string;
      };
    };
