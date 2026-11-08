/**
 * Turns a raw error into a DIAGNOSIS: a stable category (`code`) and a hint
 * written for the AI agent that will fix it. This is the "the error code
 * explains itself" part of the error system — a reference like E-7K3QX9MD
 * points at one occurrence; the code says what KIND of failure it was and
 * where to look.
 *
 * Add a rule whenever a fix teaches us something general ("this Postgres
 * code always means the migration wasn't applied"). Rules are checked in
 * order against the error and every error in its `cause` chain.
 */
export type Diagnosis = { code: string; title: string; hint: string };

type ErrorLike = {
  name?: string;
  message?: string;
  code?: string;
  type?: string;
  param?: string;
  column_name?: string;
  table_name?: string;
  constraint_name?: string;
  detail?: string;
  errno?: string;
  cause?: unknown;
};

type Rule = (e: ErrorLike) => Diagnosis | null;

const MIGRATIONS =
  'The database is behind the code: a migration in packages/db/migrations was not applied to this environment. ' +
  'Check the deploy build log for the migration step, or run `pnpm db:migrate` against this environment. If the migration exists and was applied, the schema in ' +
  'packages/db/src/schema and the query disagree — compare them.';

const pg = (code: string, d: Omit<Diagnosis, 'code'> & { id: string }): Rule => {
  return (e) => (e.code === code ? { code: d.id, title: d.title, hint: d.hint } : null);
};

const RULES: Rule[] = [
  // ---- Postgres (error.code is the SQLSTATE) ----
  pg('42P01', { id: 'db.missing_table', title: 'Table does not exist', hint: MIGRATIONS }),
  pg('42703', { id: 'db.missing_column', title: 'Column does not exist', hint: MIGRATIONS }),
  pg('42704', { id: 'db.missing_type', title: 'Type or enum does not exist', hint: MIGRATIONS }),
  pg('22P02', {
    id: 'db.invalid_value',
    title: 'Value has the wrong format for its column',
    hint:
      'A value of the wrong shape reached a query (e.g. a non-UUID string compared to a uuid column, or an ' +
      'unknown enum value). The action input schema should have rejected it — tighten the Zod schema ' +
      '(z.uuid(), z.enum([...])) for the field named in the message.',
  }),
  pg('23502', {
    id: 'db.not_null',
    title: 'Required column left empty',
    hint:
      'Code inserted/updated a row without a required column (see column_name in causes). Either the action ' +
      'forgot to set it or the input schema allows it to be missing. Fix the action, not the column.',
  }),
  pg('23503', {
    id: 'db.foreign_key',
    title: 'Points at a record that does not exist',
    hint:
      'An insert/update referenced a missing row, or a delete left rows pointing at it (see constraint_name). ' +
      'Validate the referenced id exists first (throw ActionError("not_found")) or archive instead of deleting.',
  }),
  pg('23514', {
    id: 'db.check_violation',
    title: 'A database rule (check constraint) rejected the value',
    hint: 'Mirror the CHECK constraint (constraint_name) in the action’s Zod input schema so callers get a clear message.',
  }),
  pg('40001', {
    id: 'db.serialization',
    title: 'Two changes collided',
    hint: 'Concurrent transactions conflicted. Usually safe to retry; if frequent, lock the row first (SELECT … FOR UPDATE).',
  }),
  pg('40P01', {
    id: 'db.deadlock',
    title: 'Deadlock',
    hint: 'Two transactions locked the same rows in different orders. Make every code path lock rows in the same order.',
  }),
  pg('57014', {
    id: 'db.timeout',
    title: 'Query took too long',
    hint: 'A query was cancelled (statement timeout). Look for a missing index or an unbounded query (add .limit()).',
  }),
  pg('53300', {
    id: 'db.too_many_connections',
    title: 'Database connection limit reached',
    hint:
      'Too many connections. On serverless hosts DATABASE_URL must be the provider’s POOLED connection string ' +
      '(Neon "-pooler" host, Supabase transaction pooler on port 6543). Check for scripts or a second app holding direct connections.',
  }),
  (e) =>
    e.code === '28P01' || e.code === '28000'
      ? {
          code: 'db.auth',
          title: 'Database rejected the login',
          hint: 'DATABASE_URL has a wrong password or user for this environment. Fix it in the host’s environment variables and redeploy.',
        }
      : null,
  (e) =>
    ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'CONNECT_TIMEOUT', 'ECONNRESET'].includes(
      e.code ?? e.errno ?? '',
    )
      ? {
          code: 'net.unreachable',
          title: 'Could not reach a service',
          hint:
            'A network connection failed (database or an external API — see the message for the host). ' +
            'Check that service’s status page and the URL/env var for this environment. Usually not a code bug.',
        }
      : null,

  // ---- configuration ----
  (e) =>
    /\b[A-Z][A-Z0-9_]{2,}\b is not set/.test(e.message ?? '')
      ? {
          code: 'config.missing_env',
          title: 'An environment variable is missing',
          hint: 'Set the variable named in the message in the host’s environment variables for this environment (see .env.example), then redeploy.',
        }
      : null,

  // ---- deploys ----
  (e) =>
    e.name === 'UnrecognizedActionError' || /Server Action ".*" was not found/.test(e.message ?? '')
      ? {
          code: 'deploy.version_skew',
          title: 'A browser tab was older than the deployed app',
          hint:
            'Not a code bug: a tab loaded before a deploy called a server action id that the new build no longer has. ' +
            'The web app shows a "Reload" prompt instead of reporting it; Vercel Skew Protection keeps old tabs ' +
            'working. If it keeps coming, check both are in place; otherwise mark it fixed.',
        }
      : null,

  // ---- code bugs ----
  (e) =>
    e.name === 'ZodError'
      ? {
          code: 'code.validation',
          title: 'Data failed validation inside the code',
          hint: 'A Zod .parse() inside an action failed — data from the database or an external API did not have the expected shape. Compare the schema with the actual value (see the message).',
        }
      : null,
  (e) =>
    e.name === 'TypeError' && /undefined|null/.test(e.message ?? '')
      ? {
          code: 'code.null_reference',
          title: 'Code used something that was missing',
          hint: 'A value was null/undefined where the code expected it (e.g. a query returned no row). Find the line from the stack; add a not_found check or handle the empty case.',
        }
      : null,
];

const FALLBACK: Diagnosis = {
  code: 'code.unhandled',
  title: 'Unexpected error',
  hint: 'No known pattern matched. Read the stack (first frame in packages/ or apps/web/), the action and its input, reproduce it with a test in packages/core/test, then fix.',
};

export function diagnose(err: unknown): Diagnosis {
  for (const e of chain(err)) {
    for (const rule of RULES) {
      const d = rule(e);
      if (d) return d;
    }
  }
  return FALLBACK;
}

/** The error and its causes, outermost first (max 5 deep). */
export function chain(err: unknown): ErrorLike[] {
  const out: ErrorLike[] = [];
  let e = err;
  while (e && typeof e === 'object' && out.length < 5) {
    out.push(e as ErrorLike);
    e = (e as ErrorLike).cause;
  }
  if (out.length === 0) out.push({ message: String(err) });
  return out;
}
