import { randomUUID } from 'node:crypto';

import { redact } from './redact';

/**
 * Structured logging: one JSON object per line on stdout/stderr (what Vercel, Datadog and
 * `jq` all read). Level from `LOG_LEVEL` (debug | info | warn | error; default info, `silent`
 * turns it off). Secrets are redacted with the same rules as the activity log (`redact`),
 * and every line can carry a request id so one request's lines line up with its activity-log
 * rows and error reports.
 *
 *   const log = logger({ source: 'webhook.resend', requestId });
 *   log.info('received', { type: 'email.bounced' });
 *   log.error('failed', { err, ref });          // an Error is logged as { name, message, stack }
 *   const sub = log.child({ eventId });          // adds fields to every line
 *
 * This is for tracing what happened. Anything UNEXPECTED must still go through `reportError`
 * (rule 6): logs are not an error inbox.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<LogLevel | 'silent', number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99,
};

export type Logger = {
  debug: (message: string, fields?: Record<string, unknown>) => void;
  info: (message: string, fields?: Record<string, unknown>) => void;
  warn: (message: string, fields?: Record<string, unknown>) => void;
  error: (message: string, fields?: Record<string, unknown>) => void;
  /** Same logger with extra fields on every line. */
  child: (fields: Record<string, unknown>) => Logger;
  readonly requestId: string;
};

type Sink = (level: LogLevel, line: string) => void;
const defaultSink: Sink = (level, line) => {
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else process.stdout.write(`${line}\n`);
};
let sink: Sink = defaultSink;

/** Tests: capture lines (pass null to restore stdout). */
export function setLogSinkForTests(s: Sink | null) {
  sink = s ?? defaultSink;
}

export function currentLogLevel(env: Record<string, string | undefined> = process.env) {
  const v = env.LOG_LEVEL?.trim().toLowerCase();
  return v && v in ORDER ? (v as LogLevel | 'silent') : 'info';
}

/** Error → plain object (the stack stays: logs are server-side only). */
function plainError(err: Error): Record<string, unknown> {
  const e = err as Error & { code?: unknown; cause?: unknown };
  return {
    name: e.name,
    message: e.message,
    ...(e.code !== undefined && { errorCode: e.code }),
    stack: e.stack,
    ...(e.cause instanceof Error && { cause: plainError(e.cause) }),
  };
}

function prepare(fields: Record<string, unknown>) {
  const withErrors = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, v instanceof Error ? plainError(v) : v]),
  );
  return redact(withErrors) as Record<string, unknown>;
}

export function logger(
  base: { source?: string; requestId?: string } & Record<string, unknown> = {},
) {
  const { requestId: given, ...rest } = base;
  const requestId = given ?? randomUUID();
  const make = (extra: Record<string, unknown>): Logger => {
    const emit =
      (level: LogLevel) =>
      (message: string, fields: Record<string, unknown> = {}) => {
        if (ORDER[level] < ORDER[currentLogLevel()]) return;
        const line = {
          time: new Date().toISOString(),
          level,
          message,
          requestId,
          ...prepare({ ...extra, ...fields }),
        };
        let text: string;
        try {
          text = JSON.stringify(line);
        } catch {
          // Expected: a field that cannot be serialised (circular) must never break the caller.
          text = JSON.stringify({
            time: line.time,
            level,
            message,
            requestId,
            unserialisable: true,
          });
        }
        sink(level, text);
      };
    return {
      debug: emit('debug'),
      info: emit('info'),
      warn: emit('warn'),
      error: emit('error'),
      child: (more) => make({ ...extra, ...more }),
      requestId,
    };
  };
  return make(rest);
}
