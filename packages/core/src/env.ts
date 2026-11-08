/**
 * Which environment is this code running in, where does the site live, and which outside
 * services are configured?
 *
 * - production — the `main` branch / production deploy
 * - test       — the `dev` branch (test database)
 * - preview    — any other branch's preview deploy (uses the test database)
 * - local      — a developer's machine
 *
 * Set APP_ENV explicitly to override (Vercel sets VERCEL_ENV per environment).
 *
 * `serverEnvSchema` lists every server-side variable the packages read, in one zod schema, and
 * `integrationStatus()` says which integrations are configured. Both are pure over an env
 * record (default process.env) and only ever report variable NAMES — never values — so the
 * output is safe to show in Admin or return from /api/healthcheck.
 * Add a variable here (and to .env.example and turbo.json) whenever you read a new one.
 */
import { z } from 'zod';

export type AppEnv = 'production' | 'test' | 'preview' | 'local';

export function getAppEnv(): AppEnv {
  const explicit = process.env.APP_ENV;
  if (
    explicit === 'production' ||
    explicit === 'test' ||
    explicit === 'preview' ||
    explicit === 'local'
  ) {
    return explicit;
  }
  if (process.env.VERCEL_ENV === 'production') return 'production';
  if (process.env.VERCEL_GIT_COMMIT_REF === 'dev') return 'test';
  if (process.env.VERCEL_ENV === 'preview') return 'preview';
  return 'local';
}

export const isProduction = () => getAppEnv() === 'production';

/** The public URL of this environment, for links that leave the site (emails, redirects). */
export function getSiteUrl(): string {
  const env = process.env;
  // Feature-branch previews link back to themselves, not to the test site.
  if (
    env.VERCEL_ENV === 'preview' &&
    env.VERCEL_GIT_COMMIT_REF !== 'dev' &&
    env.VERCEL_BRANCH_URL
  ) {
    return `https://${env.VERCEL_BRANCH_URL}`;
  }
  const configured = env.NEXT_PUBLIC_APP_URL ?? env.APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (env.VERCEL_ENV === 'production' && env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

// ---------- the env catalogue ----------

type Env = Record<string, string | undefined>;

const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const str = () => z.preprocess(blankToUndefined, z.string().optional());
const url = () => z.preprocess(blankToUndefined, z.url('must be a URL').optional());

/** The server env, all optional at the type level: what is REQUIRED depends on the deployment. */
export const serverEnvSchema = z.object({
  BACKEND: z.preprocess(blankToUndefined, z.enum(['neon', 'supabase']).optional()),
  DATABASE_URL: z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(/^postgres(ql)?:\/\//, 'must be a postgres:// URL')
      .optional(),
  ),
  DATABASE_URL_DIRECT: str(),
  NEXT_PUBLIC_APP_URL: url(),
  APP_URL: url(),
  OWNER_EMAILS: str(),
  CRON_SECRET: z.preprocess(
    blankToUndefined,
    z.string().min(16, 'must be at least 16 characters').optional(),
  ),
  // auth: Neon
  NEON_AUTH_BASE_URL: url(),
  NEON_AUTH_COOKIE_SECRET: z.preprocess(
    blankToUndefined,
    z.string().min(32, 'must be at least 32 characters').optional(),
  ),
  // auth: Supabase
  NEXT_PUBLIC_SUPABASE_URL: url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: str(),
  // storage (S3-compatible)
  S3_ENDPOINT: url(),
  S3_REGION: str(),
  S3_BUCKET: str(),
  S3_ACCESS_KEY_ID: str(),
  S3_SECRET_ACCESS_KEY: str(),
  // messaging
  RESEND_API_KEY: str(),
  EMAIL_FROM: str(),
  QUO_API_KEY: str(),
  QUO_FROM_NUMBER: str(),
  TEST_RECIPIENTS_EMAIL: str(),
  TEST_RECIPIENTS_SMS: str(),
  NOTIFICATIONS_SECRET: str(),
  // abuse protection
  TURNSTILE_SECRET_KEY: str(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: str(),
  // agents / API
  APP_API_KEY: str(),
  // timezone
  APP_TIME_ZONE: str(),
});

export type ServerEnvKey = keyof z.output<typeof serverEnvSchema>;

export type IntegrationId =
  | 'database'
  | 'auth'
  | 'site-url'
  | 'storage'
  | 'email'
  | 'sms'
  | 'cron'
  | 'human-check';

export type IntegrationStatus = {
  id: IntegrationId;
  label: string;
  /** What it powers / what breaks without it, one line for Admin. */
  description: string;
  /** Core: production cannot work without it. */
  core: boolean;
  configured: boolean;
  /** Names of the variables still missing (never values). */
  missing: string[];
  /** Names that are set but malformed (never values). */
  invalid: string[];
};

type IntegrationDef = Omit<IntegrationStatus, 'configured' | 'missing' | 'invalid'> & {
  /** Every name in one inner list must be set; any one inner list is enough. */
  anyOf: string[][];
  /** Names validated for format when set. */
  checks?: string[];
};

const INTEGRATIONS: IntegrationDef[] = [
  {
    id: 'database',
    label: 'Database (Postgres)',
    description: 'The server connection for every read and write. Nothing works without it.',
    core: true,
    anyOf: [['DATABASE_URL']],
  },
  {
    id: 'auth',
    label: 'Sign-in',
    description: 'Email-code sign-in (BACKEND=neon uses Neon Auth, BACKEND=supabase uses Supabase Auth).',
    core: true,
    anyOf: [
      ['NEON_AUTH_BASE_URL', 'NEON_AUTH_COOKIE_SECRET'],
      ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    ],
    checks: ['BACKEND'],
  },
  {
    id: 'site-url',
    label: 'Site URL',
    description: 'Absolute links in emails, redirects and sitemaps.',
    core: true,
    anyOf: [['NEXT_PUBLIC_APP_URL'], ['APP_URL']],
  },
  {
    id: 'storage',
    label: 'File storage (S3)',
    description: 'Uploaded files and photos.',
    core: false,
    anyOf: [['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']],
  },
  {
    id: 'email',
    label: 'Email (Resend)',
    description: 'Notifications and sign-in emails.',
    core: false,
    anyOf: [['RESEND_API_KEY', 'EMAIL_FROM']],
  },
  {
    id: 'sms',
    label: 'Text messages (Quo)',
    description: 'SMS notifications (only to people who gave consent).',
    core: false,
    anyOf: [['QUO_API_KEY', 'QUO_FROM_NUMBER']],
  },
  {
    id: 'cron',
    label: 'Scheduled jobs',
    description: 'Guards /api/cron/* so only your scheduler can run them.',
    core: false,
    anyOf: [['CRON_SECRET']],
    checks: ['CRON_SECRET'],
  },
  {
    id: 'human-check',
    label: 'Human check (Cloudflare Turnstile)',
    description: 'Bot protection on public forms.',
    core: false,
    anyOf: [['TURNSTILE_SECRET_KEY', 'NEXT_PUBLIC_TURNSTILE_SITE_KEY']],
  },
];

const isSet = (env: Env, key: string) => Boolean(env[key]?.trim());

/** Names whose current value fails the schema (never the values). */
export function invalidEnvKeys(env: Env = process.env): string[] {
  const parsed = serverEnvSchema.safeParse(env);
  if (parsed.success) return [];
  return [...new Set(parsed.error.issues.map((i) => String(i.path[0])))].sort();
}

/** Configured / missing per integration. Names only — safe to display. */
export function integrationStatus(env: Env = process.env): IntegrationStatus[] {
  const invalid = new Set(invalidEnvKeys(env));
  return INTEGRATIONS.map(({ anyOf, checks, ...def }) => {
    const satisfied = anyOf.some((group) => group.every((k) => isSet(env, k)));
    // Report the closest alternative's missing names.
    const missing = satisfied
      ? []
      : ([...anyOf]
          .map((group) => group.filter((k) => !isSet(env, k)))
          .sort((a, b) => a.length - b.length)[0] ?? []);
    const bad = [...new Set([...anyOf.flat(), ...(checks ?? [])])].filter((k) => invalid.has(k));
    return { ...def, configured: satisfied && bad.length === 0, missing, invalid: bad };
  });
}

/** Startup problems worth a loud log line: malformed values, and in production missing core integrations. */
export function serverEnvProblems(env: Env = process.env): string[] {
  const problems: string[] = [];
  for (const key of invalidEnvKeys(env)) {
    const shape = serverEnvSchema.shape[key as ServerEnvKey];
    const check = shape?.safeParse(env[key]);
    problems.push(`${key} ${check && !check.success ? check.error.issues[0]?.message : 'is invalid'}`);
  }
  if (getAppEnv() === 'production') {
    for (const s of integrationStatus(env)) {
      if (s.core && s.missing.length) {
        problems.push(`${s.label} is not configured (missing ${s.missing.join(', ')})`);
      }
    }
  }
  return problems;
}
