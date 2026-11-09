#!/usr/bin/env node
/**
 * Mechanical checks for the non-negotiable rules in AGENTS.md.
 *
 * Every rule here exists because AI (and people) follow written rules *most* of the time.
 * A failing check is followed every time. Each failure says which rule it is, why it
 * exists and how to fix it — read the message, don't just silence it.
 *
 * Escape hatch (use rarely, always with a reason a reviewer would accept):
 *   // rules-ok: <rule-id> — <why this case is fine>
 * on the offending line or the line above it (`-- rules-ok: …` in SQL).
 *
 * Usage: node scripts/check-rules.mjs [--base <git ref>]
 *   --base  ref that holds the already-applied migrations (default: origin/main if present)
 *
 * Rule ids: no-db-in-web · send-via-notify · emit-notify-in-actions ·
 * no-provider-client-for-data · app-schema-only · no-raw-colour · no-browser-dialog ·
 * no-swallowed-error · icons-from-ui-only · no-next-safe-action · app-time-zone-dates ·
 * file-size · track-new-tables · migrations-are-final
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Configuration — the only part you normally edit when you copy this repo.

const CONFIG = {
  /** The workspace scope. Find/replace `@app` repo-wide when you rename it, and change it here. */
  scope: '@app',
  /**
   * Dates shown to people use the app's time zone (APP_TIME_ZONE), but servers run in UTC, so a plain
   * toLocaleDateString() shows evening times as the next day. Set `enabled: false` if your app
   * does not show dates, or change `helper` to wherever your formatting helpers live.
   */
  dates: { enabled: true, helper: '@app/ui/lib/dates', envVar: 'APP_TIME_ZONE' },
  /** Source files longer than this are hard for AI to edit reliably. */
  maxLines: 750,
  /** Tests grow one case at a time and are read top to bottom; they get more room. */
  maxTestLines: 1_000,
  /** Where Drizzle migrations live (relative to the repo root). */
  migrationsDir: 'packages/db/migrations',
  /** The only places allowed to import an auth provider's client (BACKEND=neon|supabase). */
  authAdapterPaths: ['apps/web/lib/auth/', 'apps/web/proxy.ts'],
  /** The one file that may import the icon library. */
  iconsFile: /^packages\/ui\/src\/components\/icons\.tsx?$/,
};

const MAX_LINES = CONFIG.maxLines;
const MAX_TEST_LINES = CONFIG.maxTestLines;
const SCOPE_RE = CONFIG.scope.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&');

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const COLOUR_RE = String.raw`#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(`;
const COLOUR = new RegExp(COLOUR_RE);
/** Tailwind's built-in palette (bg-amber-50, text-red-900 …) bypasses the brand tokens. */
const TAILWIND_PALETTE =
  /(^|[\s'"`:])(bg|text|border|ring|fill|stroke|from|to|via|outline|divide|decoration|shadow|accent|caret|placeholder)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(-\d{2,3})?(\/\d+)?(?=$|[\s'"`])/;

/** Auth-provider client packages: allowed only inside the auth adapter, and never used for data. */
const PROVIDER_PKG =
  /^(@supabase\/(ssr|supabase-js|postgrest-js|storage-js)|@neondatabase\/(neon-js|auth)(\/.*)?)$/;
/** Data-access packages that only the db package may import (apps/web never). */
const DB_PKG = new RegExp(
  `^(${SCOPE_RE}\\/db(\\/.*)?|drizzle-orm(\\/.*)?|postgres|pg|@neondatabase\\/serverless)$`,
);
const ICON_PKG =
  /^(@phosphor-icons\/.*|lucide-react|react-icons(\/.*)?|@heroicons\/.*|@radix-ui\/react-icons|@tabler\/icons(-react)?|@remixicon\/react|@iconify\/.*|phosphor-react)$/;
const SAFE_ACTION_PKG = /^(next-safe-action(\/.*)?|@kit\/next\/safe-action)$/;

const MESSAGES = {
  'no-db-in-web':
    'Rule 1 — the web app never queries the database. All business reads/writes go through an\n' +
    'action (packages/core/src/actions). Call it with callAction() on the server or useAction() /\n' +
    '<ActionForm> in a client component. Need new data? Add or extend an action (skill: add-action).',
  'send-via-notify':
    'Rule 8 — telling someone something = notify(tx, "type", …) inside the action, so preferences,\n' +
    'consent, quiet hours, retries and the delivery log apply (docs/architecture.md → Notifications).\n' +
    'sendEmail/sendSms are only for packages/core/src/notifications (skill: add-notification).',
  'emit-notify-in-actions':
    'Rules 7/8 — emit() and notify() run inside an action’s transaction (tx), never from a page or\n' +
    'component: nothing should be sent or announced for a change that did not save.\n' +
    'Move the call into the action that makes the change (skill: add-action / add-notification).',
  'no-provider-client-for-data':
    'Rule 9 — data goes ONLY through Drizzle over DATABASE_URL (packages/db) inside actions. Neither the\n' +
    'Supabase JS client nor the Neon Data API / PostgREST is used for data: authorization lives in\n' +
    'actions, and the two backends must stay interchangeable (docs/choosing-a-backend.md).\n' +
    'A provider client may be imported only in apps/web/lib/auth/ (and proxy.ts), for sign-in only.',
  'app-schema-only':
    'Rule 10 — our tables live in the `app` schema: define them with `app.table(…)` from\n' +
    'packages/db/src/schema/_shared.ts, never pgTable() / the public schema.',
  'no-raw-colour':
    'Rule 4 — no raw colours in the app (hex/rgb/oklch, or Tailwind palette classes like\n' +
    'bg-amber-50). Use the design tokens (bg-primary, text-muted-foreground,\n' +
    'border-border …) from packages/ui/src/styles/globals.css, or THEME_COLORS from\n' +
    `${CONFIG.scope}/ui/lib/theme-colors where a literal colour string is unavoidable (manifests, meta tags).\n` +
    'Brand-owned artwork (e.g. a third-party logo) may use rules-ok with a reason.',
  'app-time-zone-dates':
    'Dates shown to people use the app time zone, but the server runs in UTC, so a plain\n' +
    'toLocaleDateString() shows evening times as the next day. Use formatDate / formatDateTime /\n' +
    `formatDay from '${CONFIG.dates.helper}' (or pass an explicit timeZone: …). The zone is ${CONFIG.dates.envVar}.\n` +
    'Turn this rule off in CONFIG.dates if your app shows no dates.',
  'no-browser-dialog':
    'Rule 4 — no window.confirm / prompt / alert: they look out of place and can be blocked.\n' +
    `Use confirm(), prompt() or alert() from '${CONFIG.scope}/ui/components/alert-dialog' (await them;\n` +
    'the <DialogsHost /> in the root layout shows them in the app’s look).',
  'no-swallowed-error':
    'Rule 6 — never swallow an unexpected error. In the catch: rethrow, call\n' +
    'reportError(err, { source, … }) and show the returned reference, or — if failing here is\n' +
    'genuinely expected and harmless — say so in a comment inside the catch block.',
  'icons-from-ui-only':
    'Rule 4 — icons are Phosphor, imported from `' +
    CONFIG.scope +
    '/ui/components/icons` (PlusIcon …), never from\n' +
    'an icon package directly and never another icon library. Missing one? Add it to the export list in\n' +
    'packages/ui/src/components/icons.tsx.',
  'no-next-safe-action':
    'Server actions are not written with next-safe-action (or authActionClient). Business logic is\n' +
    'defineAction() in packages/core; the UI calls it through <ActionForm action="area.verb"> or\n' +
    'useAction() → invokeAction (docs/actions.md). Add/extend an action instead (skill: add-action).',
  'file-size': (n, limit) =>
    `Files over ${limit} lines are hard for AI to edit reliably (this one has ${n}). Split it by\n` +
    'responsibility — e.g. actions/<area>/<verb>.ts, one file per action or per group of actions,\n' +
    're-exported from actions/<area>/index.ts.',
  'track-new-tables': (t) =>
    `Rule 5 — table app.${t} has no field history. Add a custom migration\n` +
    `(pnpm --filter ${CONFIG.scope}/db exec drizzle-kit generate --custom) containing\n` +
    `  SELECT app.track_changes('app.${t}', '<subject column>');\n` +
    'or, if it is a log/queue that must not be tracked, add it to UNTRACKED_TABLES in\n' +
    'scripts/check-rules.mjs with the reason (skill: add-migration).',
  'migrations-are-final': (base, status) =>
    `Rule 5 — this migration already exists on ${base} (status ${status}: modified/deleted). Applied\n` +
    'migrations are never edited, renamed or deleted — the databases have already run them.\n' +
    'Revert the change and add a NEW migration instead (pnpm db:generate).',
};

/** Tables that deliberately have no field-level history (they ARE logs, or are churny infra). */
const UNTRACKED_TABLES = {
  activity_log: 'is the activity log itself',
  change_log: 'is the change history itself',
  error_events: 'is a log of errors',
  cron_runs: 'a log of scheduled-job runs',
  heartbeats: 'cron pings, overwritten every minute',
  idempotency_keys: 'short-lived request de-duplication',
  jobs: 'queue rows; the job’s effects are tracked where they land',
  notification_deliveries: 'is the delivery log',
  notifications: 'inbox items are a log of what was said',
  rate_limit_hits: 'counters, deleted daily',
  events: 'the automation outbox — a log of what happened',
  automation_runs: 'a log of automation runs (the rules themselves are tracked)',
  automation_steps: 'a log of each run’s steps',
  // Add your own logs/queues here, each with the reason.
};

/** Files that are written by scripts — never edited by hand, never checked. */
const GENERATED = [/\.generated\.(ts|md)$/, /^packages\/db\/migrations\/meta\//];

// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const baseArg = args.includes('--base') ? args[args.indexOf('--base') + 1] : null;

const problems = [];
function report(file, line, rule, message) {
  problems.push({ file, line, rule, message });
}

const files = listFiles(['apps', 'packages'])
  .filter((f) => !GENERATED.some((re) => re.test(f)))
  .filter((f) => !f.includes('node_modules/'));

const sourceFiles = files.filter((f) => /\.(ts|tsx|mts|mjs)$/.test(f) && !f.endsWith('.d.ts'));

// TypeScript is a root devDependency; an empty tree needs none of it.
let ts = null;
if (sourceFiles.length) {
  try {
    ts = require('typescript');
  } catch {
    console.error('typescript is not installed — run `pnpm install` first.');
    process.exit(1);
  }
}

for (const file of sourceFiles) {
  let text;
  try {
    text = readFileSync(path.join(ROOT, file), 'utf8');
  } catch {
    continue; // deleted in the working tree but still in the index
  }
  checkSource(file, text);
}

for (const file of files.filter((f) => f.endsWith('.css') && f.startsWith('apps/web/'))) {
  const text = readFileSync(path.join(ROOT, file), 'utf8');
  text.split('\n').forEach((line, i) => {
    if (COLOUR.test(stripCssComments(line)) && !allowed(text, i, 'no-raw-colour')) {
      report(file, i + 1, 'no-raw-colour', MESSAGES['no-raw-colour']);
    }
  });
}

checkMigrations();

// ---------------------------------------------------------------------------

if (problems.length) {
  const byRule = new Map();
  for (const p of problems) byRule.set(p.rule, [...(byRule.get(p.rule) ?? []), p]);
  for (const [rule, list] of byRule) {
    console.error(`\n✗ ${rule} (${list.length})`);
    console.error(indent(list[0].message));
    for (const p of list) console.error(`    ${p.file}${p.line ? `:${p.line}` : ''}`);
  }
  console.error(
    `\n${problems.length} rule violation(s). Fix them, or — only if the case is genuinely fine —` +
      `\nadd "// rules-ok: <rule-id> — <reason>" on or above the line.`,
  );
  process.exit(1);
}
console.log(`Rules check passed (${sourceFiles.length} files).`);

// ---------------------------------------------------------------------------

function checkSource(file, text) {
  const inWeb = file.startsWith('apps/web/');
  const isTest = /(^|\/)(test|e2e)\//.test(file) || /\.(test|spec)\.tsx?$/.test(file);
  const lines = text.split('\n');

  // ── file size ────────────────────────────────────────────────────────────
  const limit = isTest ? MAX_TEST_LINES : MAX_LINES;
  if (lines.length > limit && !allowed(text, 0, 'file-size')) {
    report(file, 0, 'file-size', MESSAGES['file-size'](lines.length, limit));
  }

  const sf = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
  const flag = (node, rule, message = MESSAGES[rule]) => {
    const line = lineOf(node);
    if (!allowed(text, line, rule)) report(file, line + 1, rule, message);
  };

  const inAuthAdapter = CONFIG.authAdapterPaths.some((p) => file === p || file.startsWith(p));
  const importsProvider = [...text.matchAll(/from ['"]([^'"]+)['"]/g)].some((m) =>
    PROVIDER_PKG.test(m[1]),
  );

  const visit = (node) => {
    // ── imports ────────────────────────────────────────────────────────────
    const spec = moduleSpecifier(node);
    if (spec) {
      // Rule 1: the web app never touches the database directly.
      if (inWeb && DB_PKG.test(spec)) flag(node, 'no-db-in-web');

      // Rule 8: only the notification system sends messages.
      if (
        new RegExp(`(^${SCOPE_RE}\\/core\\/messaging$|\\/messaging(\\/index)?(\\.ts)?$)`).test(
          spec,
        ) &&
        !/^packages\/core\/src\/(messaging|notifications)\//.test(file) &&
        !isTest &&
        importsNames(node, ['sendEmail', 'sendSms'])
      ) {
        flag(node, 'send-via-notify');
      }

      // Rules 7/8: emit() / notify() only inside actions (never in the web app).
      if (
        inWeb &&
        new RegExp(`^${SCOPE_RE}\\/core(\\/.*)?$`).test(spec) &&
        importsNames(node, ['emit', 'notify'])
      ) {
        flag(node, 'emit-notify-in-actions');
      }

      // Rule 9: provider clients only in the auth adapter; the Data API packages nowhere.
      if (PROVIDER_PKG.test(spec) && !isTest) {
        if (spec.endsWith('postgrest-js') || !inAuthAdapter)
          flag(node, 'no-provider-client-for-data');
      }

      // Rule 4: icons come from the ui package's icon list.
      if (ICON_PKG.test(spec) && !CONFIG.iconsFile.test(file)) flag(node, 'icons-from-ui-only');

      // No next-safe-action.
      if (SAFE_ACTION_PKG.test(spec)) flag(node, 'no-next-safe-action');
    }

    if (
      ts.isIdentifier(node) &&
      node.text === 'authActionClient' &&
      !ts.isImportSpecifier(node.parent)
    ) {
      flag(node, 'no-next-safe-action');
    }

    // ── Rule 9: no data through a provider client (.from / .rpc / .storage / .schema) ──
    if (
      importsProvider &&
      ts.isPropertyAccessExpression(node) &&
      ['from', 'rpc', 'storage', 'schema'].includes(node.name.text) &&
      !/^(Array|Buffer|Uint8Array|Object|String|Promise|Iterator)$/.test(
        node.expression.getText(sf),
      )
    ) {
      flag(node, 'no-provider-client-for-data');
    }

    // ── Rule 10: tables only in the app schema ─────────────────────────────
    if (
      file.startsWith('packages/db/src/') &&
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'pgTable'
    ) {
      flag(node, 'app-schema-only');
    }

    if (
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateExpression(node) ||
      ts.isStringLiteral(node)
    ) {
      const raw = node.getText(sf);
      // Rule 9: PostgREST / Data API URLs are never called from our code.
      if (/\/rest\/v1\b/.test(raw) && !isTest) flag(node, 'no-provider-client-for-data');
      // Rule 4: no raw colours in the web app (packages/ui owns the tokens).
      if (
        inWeb &&
        (COLOUR.test(raw) || TAILWIND_PALETTE.test(raw)) &&
        !/^['"`]\s*(https?:|data:)/.test(raw)
      ) {
        flag(node, 'no-raw-colour');
      }
    }

    // ── Dates: the app time zone, never the server's UTC ───────────────────
    if (
      CONFIG.dates.enabled &&
      inWeb &&
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      (/^toLocale(Date|Time)String$/.test(node.expression.name.text) ||
        (node.expression.name.text === 'toLocaleString' &&
          /^new Date\b/.test(node.expression.expression.getText(sf)))) &&
      !/timeZone/.test(node.arguments.map((a) => a.getText(sf)).join(','))
    ) {
      flag(node, 'app-time-zone-dates');
    }

    // ── Rule 4: in-app dialogs, not the browser's ──────────────────────────
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ['confirm', 'prompt', 'alert'].includes(node.expression.name.text) &&
      /^(window|globalThis|self)$/.test(node.expression.expression.getText(sf))
    ) {
      flag(node, 'no-browser-dialog');
    }

    // ── Rule 6: never swallow an unexpected error ──────────────────────────
    if (ts.isCatchClause(node)) {
      if (swallows(node.block, node.variableDeclaration?.name, sf))
        flag(node, 'no-swallowed-error');
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'catch' &&
      node.arguments.length === 1 &&
      (ts.isArrowFunction(node.arguments[0]) || ts.isFunctionExpression(node.arguments[0]))
    ) {
      const fn = node.arguments[0];
      const param = fn.parameters[0]?.name;
      const body = ts.isBlock(fn.body) ? fn.body : null;
      const usesParam = param && ts.isIdentifier(param) && mentions(fn.body, param.text);
      const hasComment =
        hasCommentIn(text, node.expression.expression.end, fn.end) || commentAbove(node, sf);
      const handles = mentionsCall(fn.body, ['reportError', 'notify']) || (body && rethrows(body));
      if (!usesParam && !hasComment && !handles) flag(node, 'no-swallowed-error');
    }

    ts.forEachChild(node, visit);
  };
  visit(sf);
}

function swallows(block, binding, sf) {
  const text = sf.getFullText();
  if (hasCommentIn(text, block.getStart(sf), block.end)) return false; // explained
  if (rethrows(block)) return false;
  if (mentionsCall(block, ['reportError', 'notify'])) return false;
  if (binding && ts.isIdentifier(binding) && mentions(block, binding.text)) return false;
  return true;
}

/** A comment directly above the node or any enclosing node up to its statement. */
function commentAbove(node, sf) {
  const full = sf.getFullText();
  for (let n = node; n && !ts.isSourceFile(n); n = n.parent) {
    if (/\/\/|\/\*/.test(full.slice(n.getFullStart(), n.getStart(sf)))) return true;
    if (n.parent && (ts.isBlock(n.parent) || ts.isSourceFile(n.parent))) break;
  }
  return false;
}

function rethrows(node) {
  let found = false;
  const walk = (n) => {
    if (found) return;
    if (ts.isThrowStatement(n)) found = true;
    // Don't look inside nested functions: a throw there isn't this handler's.
    if (ts.isFunctionLike(n) && n !== node) return;
    ts.forEachChild(n, walk);
  };
  walk(node);
  return found;
}

/** Uses `name` somewhere other than a console.* call (logging to the console is still swallowing). */
function mentions(node, name) {
  let found = false;
  const walk = (n) => {
    if (found) return;
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      ts.isIdentifier(n.expression.expression) &&
      n.expression.expression.text === 'console'
    ) {
      return;
    }
    if (ts.isIdentifier(n) && n.text === name) found = true;
    ts.forEachChild(n, walk);
  };
  walk(node);
  return found;
}

function mentionsCall(node, names) {
  let found = false;
  const walk = (n) => {
    if (found) return;
    if (ts.isCallExpression(n)) {
      const callee = n.expression;
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : null;
      if (name && names.includes(name)) found = true;
    }
    ts.forEachChild(n, walk);
  };
  walk(node);
  return found;
}

function hasCommentIn(text, start, end) {
  const slice = text.slice(start, end);
  return /\/\/|\/\*/.test(slice);
}

function moduleSpecifier(node) {
  if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
    return ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : null;
  }
  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword &&
    node.arguments[0] &&
    ts.isStringLiteral(node.arguments[0])
  ) {
    return node.arguments[0].text;
  }
  return null;
}

function importsNames(node, names) {
  if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) return true;
  const clause = ts.isImportDeclaration(node)
    ? node.importClause?.namedBindings
    : node.exportClause;
  if (!clause) return true; // `import * as` / side-effect import: treat as using everything
  if (ts.isNamespaceImport?.(clause) || ts.isNamespaceExport?.(clause)) return true;
  return clause.elements.some((el) => names.includes((el.propertyName ?? el.name).text));
}

// ---------------------------------------------------------------------------
// Migrations: rules 5 and 10

function checkMigrations() {
  const dir = CONFIG.migrationsDir;
  const sqlFiles = files.filter((f) => f.startsWith(`${dir}/`) && f.endsWith('.sql')).sort();

  // Every app table records its changes (or is on the deliberate list above).
  const created = new Map();
  const tracked = new Set();
  for (const f of sqlFiles) {
    const text = readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of text.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"?app"?\."?([a-z_0-9]+)"?/gi)) {
      if (!created.has(m[1])) created.set(m[1], f);
    }
    for (const m of text.matchAll(/track_changes\(\s*'app\.([a-z_0-9]+)'/g)) tracked.add(m[1]);
    // Business tables never go in `public`.
    text.split('\n').forEach((line, i) => {
      if (
        /CREATE TABLE (IF NOT EXISTS )?("public"\.|public\.|"[a-z_0-9]+" ?\(|[a-z_0-9]+ ?\()/i.test(
          line,
        ) &&
        !allowed(text, i, 'app-schema-only')
      ) {
        report(f, i + 1, 'app-schema-only', MESSAGES['app-schema-only']);
      }
    });
  }
  for (const [table, f] of created) {
    if (!tracked.has(table) && !(table in UNTRACKED_TABLES)) {
      report(f, 0, 'track-new-tables', MESSAGES['track-new-tables'](table));
    }
  }

  // Applied migrations are never edited, renamed or deleted.
  const base = baseArg ?? (refExists('origin/main') ? 'origin/main' : null);
  if (!base) {
    console.warn(
      '! no origin/main to compare migrations against — skipped the "edited migration" check',
    );
    return;
  }
  // Compare with where this branch left main: migrations added to main since then aren't
  // "deleted" here, they just haven't been merged in yet.
  let since = base;
  try {
    since = git(['merge-base', 'HEAD', base]).trim();
  } catch {
    // No common history (very shallow clone, or no commits yet): compare with the ref itself.
  }
  let changed = [];
  try {
    changed = git(['diff', '--name-status', '--no-renames', since, '--', `${dir}/*.sql`])
      .split('\n')
      .filter(Boolean);
  } catch {
    console.warn('! could not diff against the base ref — skipped the "edited migration" check');
  }
  for (const row of changed) {
    const [status, f] = row.split('\t');
    if (status === 'A') continue;
    report(f, 0, 'migrations-are-final', MESSAGES['migrations-are-final'](base, status));
  }
}

// ---------------------------------------------------------------------------

function allowed(text, lineIndex, rule) {
  const lines = text.split('\n');
  const re = new RegExp(`rules-ok:\\s*${rule}\\b\\s*[—–:-]+\\s*\\S`);
  return [lines[lineIndex], lines[lineIndex - 1]].some((l) => l && re.test(l));
}

function git(argv) {
  return execFileSync('git', argv, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function refExists(ref) {
  try {
    git(['rev-parse', '--verify', '--quiet', ref]);
    return true;
  } catch {
    return false; // the ref simply isn't there (shallow clone, no remote)
  }
}

/** Tracked + untracked-not-ignored files under `dirs`; walks the disk if this isn't a git checkout. */
function listFiles(dirs) {
  try {
    return git(['ls-files', '--cached', '--others', '--exclude-standard', ...dirs])
      .split('\n')
      .filter(Boolean);
  } catch {
    // Not a git checkout: walk the disk instead.
    const out = [];
    const walk = (rel) => {
      const abs = path.join(ROOT, rel);
      if (!existsSync(abs)) return;
      for (const name of readdirSync(abs)) {
        if (['node_modules', '.next', '.git', '.turbo', 'dist'].includes(name)) continue;
        const r = `${rel}/${name}`;
        if (statSync(path.join(ROOT, r)).isDirectory()) walk(r);
        else out.push(r);
      }
    };
    dirs.forEach(walk);
    return out;
  }
}

function stripCssComments(line) {
  return line.replace(/\/\*.*?\*\//g, '');
}

function indent(s) {
  return s
    .split('\n')
    .map((l) => `  ${l}`)
    .join('\n');
}
