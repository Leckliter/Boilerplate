#!/usr/bin/env node
/**
 * Turn a fresh copy of the boilerplate into your project (skill: new-project-from-boilerplate).
 *
 *   node scripts/new-project.mjs --name "Acme Rentals" --scope @acme --backend supabase \
 *        --modules automations,docs            # modules to REMOVE
 *   node scripts/new-project.mjs --name "Acme Rentals" --scope @acme --backend neon --dry-run
 *
 * Options
 *   --name <text>        display name ("Acme Rentals"): the site, logo, manifest, emails, README
 *   --scope <@scope>     the npm scope that replaces `@app` (default: derived from the name, `@acme-rentals`)
 *   --slug <kebab>       root package name / default database name (default: from --name)
 *   --backend <neon|supabase>   the provider to KEEP; the other one's adapter, env block and deps are removed
 *   --modules <a,b>      optional modules to REMOVE: automations (events + automations), docs, brand.
 *                        `--modules list` prints them. (REST + MCP, notifications and jobs are coupled to
 *                        auth, actors and the delivery log: remove them by hand, docs/architecture.md → Modules.)
 *   --dir <path>         the repo to change (default: this repo)
 *   --dry-run            print what would change; write nothing
 *   --no-format          skip Prettier
 *   --no-install         skip `pnpm install` (default: runs it so the lockfile and workspace links match)
 *   --install-offline    `pnpm install --offline` (CI, tests)
 *   --no-generate        skip `pnpm db:generate` (the migration that drops a removed module's tables)
 *
 * Safe to run twice: every step looks at the current state first, so a second run reports "nothing to
 * do". Each part can be run alone (omit --name, --backend or --modules). It never touches `.git`,
 * `node_modules`, a database or a hosted service, and it never commits.
 *
 * What it will not do (it prints these as follow-ups): rewrite prose in the docs, pick your brand
 * colours (packages/ui/src/styles/globals.css), create the Neon/Supabase project, or remove
 * `next-intl` (translations) — those are decisions, not renames.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------------------------
// Modules. Each entry says how to take one optional module out. Folders are deleted; `drop` lists
// lines, JSON keys, array items and calls to remove from files that stay. The test
// (scripts/new-project.test.mjs) typechecks the result, so a stale entry here fails CI.

/** @typedef {{ file: string, replace?: [RegExp, string][], lines?: RegExp, followLines?: number, scriptsRegex?: [string, RegExp, string][], from?: RegExp, jsonKeys?: string[][], arrayItems?: string[], jsx?: string[], calls?: string[] }} Drop */
/** @type {Record<string, { title: string, delete: string[], drop: Drop[], leftovers?: { imports?: RegExp, names?: string[] } }>} */
export const MODULES = {
  automations: {
    title: 'Events + automations (emit(), automations.*, events.list)',
    delete: [
      'packages/core/src/automations',
      'packages/core/src/events',
      'packages/core/src/actions/automations',
      'packages/core/src/actions/events',
      'packages/core/test/automations.test.ts',
      'packages/core/test/events.test.ts',
      'packages/db/src/schema/automations.ts',
      'apps/web/app/admin/automations',
      'apps/web/components/automations',
      'docs/automations.md',
      'docs/events.md',
      'docs/events.generated.md',
    ],
    drop: [
      { file: 'packages/core/src/modules.ts', lines: /['"]\.\/automations\/register['"]/ },
      {
        file: 'packages/core/package.json',
        jsonKeys: [
          ['exports', './events'],
          ['exports', './automations'],
        ],
      },
      { file: 'packages/db/src/schema/index.ts', lines: /['"]\.\/automations['"]/ },
      { file: 'apps/web/lib/nav.ts', arrayItems: ['/admin/automations'] },
      { file: 'docs/README.md', lines: /\]\((automations|events)(\.generated)?\.md\)/ },
      // Every `await emit(tx, 'event', …)` in an action: the events module is gone, so nothing listens.
      { file: 'packages/core/src', calls: ['emit'], from: /(^|\/)events(\/emit)?$/ },
      // The action-docs generator only adds the event catalog when the folder exists, but still imports it.
      {
        file: 'packages/core/scripts/generate-action-docs.ts',
        replace: [
          [
            /\/\/ The events module[^\n]*\n(?:[^\n]*\n)*?if \(existsSync\([^\n]*events\/docs\.ts[^\n]*\n(?:[^\n]*\n)*?\}\n/,
            '',
          ],
        ],
      },
    ],
    // Other code that reads what this module owned: shown as "Needs you" because what to do with
    // it (drop a clean-up step, a search source, a test) is a decision about your project.
    leftovers: {
      imports: /(^|\/)(events|automations)(\/[\w-]+)?$/,
      names: [
        'automations',
        'automationRuns',
        'automationSteps',
        'events',
        'eventDeliveries',
        'emit',
        'EVENT_TYPES',
      ],
    },
  },
  docs: {
    title: 'In-app help (/docs, content/docs, docs.* actions)',
    delete: [
      'apps/web/app/(site)/docs',
      'apps/web/components/docs',
      'apps/web/content',
      'packages/core/src/docs',
      'packages/core/src/actions/docs',
      'packages/core/scripts/build-docs.ts',
      'packages/core/test/docs.test.ts',
      'docs/docs-system.md',
    ],
    drop: [
      { file: 'packages/core/src/modules.ts', lines: /['"]\.\/docs\/register['"]/ },
      {
        file: 'packages/core/package.json',
        jsonKeys: [
          ['exports', './docs'],
          ['scripts', 'docs:build'],
        ],
      },
      { file: 'package.json', jsonKeys: [['scripts', 'docs:build']] },
      { file: 'apps/web/lib/nav.ts', arrayItems: ['/docs'] },
      { file: 'apps/web/components/site/site-header.tsx', arrayItems: ['/docs'] },
      { file: 'apps/web/components/site/site-footer.tsx', jsx: ['/docs'] },
      { file: 'apps/web/app/sitemap.ts', arrayItems: ['/docs'] },
      { file: 'docs/README.md', lines: /\]\(docs-system\.md\)/ },
      {
        file: '.github/workflows/ci.yml',
        lines: /^\s*- name: In-app docs are up to date\s*$/,
        followLines: 1,
      },
      { file: 'package.json', scriptsRegex: [['check', /\s*&&\s*pnpm docs:build --check/, '']] },
    ],
    leftovers: { imports: /(^|\/)docs(\/[\w-]+)?$/, names: ['searchDocs', 'listDocs'] },
  },
  brand: {
    title: 'The /brand style guide',
    delete: ['apps/web/app/brand', 'apps/web/components/brand'],
    drop: [
      { file: 'apps/web/components/site/site-header.tsx', arrayItems: ['/brand'] },
      { file: 'apps/web/components/site/site-footer.tsx', jsx: ['/brand'] },
      { file: 'apps/web/app/sitemap.ts', arrayItems: ['/brand'] },
    ],
  },
};

// ---------------------------------------------------------------------------------------------
// Arguments

function parseArgs(argv) {
  const out = { flags: new Set(), values: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`Unexpected argument: ${a}`);
    const [key, inline] = a.slice(2).split(/=(.*)/s, 2);
    const boolean = [
      'dry-run',
      'no-format',
      'no-install',
      'install-offline',
      'no-generate',
      'help',
    ];
    if (boolean.includes(key)) out.flags.add(key);
    else out.values[key] = inline ?? argv[++i];
  }
  return out;
}

const kebab = (s) =>
  s
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');

function validate(opts) {
  const problems = [];
  if (opts.scope && !/^@[a-z0-9][a-z0-9-]*$/.test(opts.scope)) {
    problems.push(
      `--scope must look like @acme (lowercase letters, digits, dashes), got "${opts.scope}"`,
    );
  }
  if (opts.slug && !/^[a-z0-9][a-z0-9-]*$/.test(opts.slug))
    problems.push(`--slug must be kebab-case, got "${opts.slug}"`);
  if (opts.backend && !['neon', 'supabase'].includes(opts.backend))
    problems.push('--backend must be neon or supabase');
  for (const m of opts.modules)
    if (!MODULES[m])
      problems.push(`Unknown module "${m}". Known: ${Object.keys(MODULES).join(', ')}`);
  return problems;
}

// ---------------------------------------------------------------------------------------------
// A tiny virtual file system, so a dry run can say exactly what would happen and a real run writes
// everything at the end (and later steps see earlier steps' edits).

class Tree {
  constructor(root) {
    this.root = root;
    /** @type {Map<string, string | null>} relative path -> new content, or null = deleted */
    this.changes = new Map();
    /** @type {Set<string>} directories removed whole */
    this.removedDirs = new Set();
  }
  abs(rel) {
    return path.join(this.root, rel);
  }
  exists(rel) {
    if (this.changes.has(rel)) return this.changes.get(rel) !== null;
    if ([...this.removedDirs].some((d) => rel === d || rel.startsWith(`${d}/`))) return false;
    return existsSync(this.abs(rel));
  }
  read(rel) {
    if (this.changes.has(rel)) {
      const v = this.changes.get(rel);
      if (v === null) throw new Error(`${rel} was removed`);
      return v;
    }
    return readFileSync(this.abs(rel), 'utf8');
  }
  write(rel, content) {
    if (this.exists(rel) && this.read(rel) === content) return false;
    this.changes.set(rel, content);
    return true;
  }
  /** Delete a file or a whole folder. Returns true when something was there. */
  remove(rel) {
    if (!this.exists(rel)) return false;
    const onDisk = existsSync(this.abs(rel));
    if (onDisk && statSync(this.abs(rel)).isDirectory()) {
      this.removedDirs.add(rel);
      for (const k of this.changes.keys()) if (k.startsWith(`${rel}/`)) this.changes.delete(k);
    } else {
      this.changes.set(rel, null);
    }
    return true;
  }
  /** Files on disk (not in skip dirs), minus removed ones, plus new ones. */
  files() {
    const out = [];
    const walk = (rel) => {
      for (const name of readdirSync(this.abs(rel || '.'))) {
        if (SKIP_DIRS.has(name)) continue;
        const r = rel ? `${rel}/${name}` : name;
        if (!this.exists(r)) continue;
        if (statSync(this.abs(r)).isDirectory()) walk(r);
        else out.push(r);
      }
    };
    walk('');
    for (const [k, v] of this.changes)
      if (v !== null && !out.includes(k) && this.exists(k)) out.push(k);
    return out;
  }
  commit() {
    for (const d of this.removedDirs) rmSync(this.abs(d), { recursive: true, force: true });
    for (const [rel, content] of this.changes) {
      if (content === null) rmSync(this.abs(rel), { force: true });
      else {
        mkdirSync(path.dirname(this.abs(rel)), { recursive: true });
        writeFileSync(this.abs(rel), content);
      }
    }
  }
}

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.next-e2e',
  '.turbo',
  '.vercel',
  'test-results',
  'playwright-report',
  'coverage',
  'dist',
]);
const TEXT_EXT =
  /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|json|md|mdx|css|yml|yaml|html|sql|txt|toml|env|example|sh|svg|webmanifest)$/i;
const TEXT_NAMES = new Set([
  'Dockerfile',
  '.dockerignore',
  '.gitignore',
  '.prettierignore',
  '.editorconfig',
  '.nvmrc',
  'CODEOWNERS',
  '.env.example',
]);
/** The tool's own files keep saying `@app`: they describe the boilerplate, not your project. */
const SELF = new Set([
  'scripts/new-project.mjs',
  'scripts/new-project.test.mjs',
  '.claude/skills/new-project-from-boilerplate/SKILL.md',
]);
const isText = (rel) => TEXT_EXT.test(rel) || TEXT_NAMES.has(path.basename(rel));

// ---------------------------------------------------------------------------------------------
// TypeScript-aware edits (parse, find nodes, cut text). The compiler API is already a dev dependency.

let ts;
function loadTs(root) {
  if (ts) return ts;
  for (const base of [root, HERE]) {
    try {
      ts = createRequire(path.join(base, 'package.json'))('typescript');
      return ts;
    } catch {
      // Expected: try the next place; the error below says what to do when none has it.
    }
  }
  throw new Error(
    'The `typescript` package is needed for the module edits. Run `pnpm install` first.',
  );
}

function sourceOf(rel, text) {
  const t = loadTs();
  return t.createSourceFile(
    rel,
    text,
    t.ScriptTarget.Latest,
    true,
    rel.endsWith('x') ? t.ScriptKind.TSX : t.ScriptKind.TS,
  );
}

/** Cut ranges (and the comma that follows an array item) out of `text`, last first. */
function cut(text, ranges) {
  let out = text;
  for (const [start, end] of ranges.sort((a, b) => b[0] - a[0])) {
    let e = end;
    while (/[ \t]/.test(out[e] ?? '')) e++;
    if (out[e] === ',') e++;
    // Take the whole line when nothing else is on it.
    let s = start;
    while (s > 0 && /[ \t]/.test(out[s - 1])) s--;
    const lineStart = s === 0 || out[s - 1] === '\n';
    while (/[ \t]/.test(out[e] ?? '')) e++;
    const lineEnd = out[e] === '\n' || e >= out.length;
    if (lineStart && lineEnd) out = out.slice(0, s) + out.slice(e + 1);
    else out = out.slice(0, start) + out.slice(end);
  }
  return out;
}

const propName = (p) => (p.name && (p.name.text ?? p.name.getText?.())) || '';

/** Remove array elements: `{ href: '/x', … }` objects or plain `'/x'` strings. */
function removeArrayItems(rel, text, hrefs) {
  const t = loadTs();
  const sf = sourceOf(rel, text);
  const ranges = [];
  const visit = (node) => {
    if (t.isArrayLiteralExpression(node)) {
      for (const el of node.elements) {
        const hit =
          (t.isStringLiteralLike(el) && hrefs.includes(el.text)) ||
          (t.isObjectLiteralExpression(el) &&
            el.properties.some(
              (p) =>
                t.isPropertyAssignment(p) &&
                propName(p) === 'href' &&
                t.isStringLiteralLike(p.initializer) &&
                hrefs.includes(p.initializer.text),
            ));
        if (hit) ranges.push([el.getStart(sf), el.getEnd()]);
      }
    }
    t.forEachChild(node, visit);
  };
  visit(sf);
  return ranges.length ? cut(text, ranges) : text;
}

/** Remove JSX elements (`<Link href="/x">…</Link>`) whose `href` is one of `hrefs`. */
function removeJsxByHref(rel, text, hrefs) {
  const t = loadTs();
  const sf = sourceOf(rel, text);
  const ranges = [];
  const visit = (node) => {
    const opening = t.isJsxElement(node)
      ? node.openingElement
      : t.isJsxSelfClosingElement(node)
        ? node
        : null;
    if (opening) {
      const href = opening.attributes.properties.find(
        (a) => t.isJsxAttribute(a) && a.name.getText(sf) === 'href',
      );
      const value = href?.initializer;
      if (value && t.isStringLiteral(value) && hrefs.includes(value.text)) {
        ranges.push([node.getStart(sf), node.getEnd()]);
        return;
      }
    }
    t.forEachChild(node, visit);
  };
  visit(sf);
  return ranges.length ? cut(text, ranges) : text;
}

/**
 * Remove `await name(…);` statements (and the import of `name` once nothing else uses it). A call whose
 * result is used (`const id = await emit(…)`) is left alone and reported.
 */
function removeCalls(rel, text, names, fromModule) {
  const t = loadTs();
  const sf = sourceOf(rel, text);
  // Only the events module's `emit` (imported from it), not an unrelated local function with the same name.
  const imported = sf.statements.some(
    (st) =>
      t.isImportDeclaration(st) &&
      fromModule.test(st.moduleSpecifier.text) &&
      st.importClause?.namedBindings &&
      t.isNamedImports(st.importClause.namedBindings) &&
      st.importClause.namedBindings.elements.some((e) => names.includes(e.name.text)),
  );
  if (!imported) return { text, left: [], removed: 0 };
  const ranges = [];
  const left = [];
  const callee = (e) => {
    const x = t.isAwaitExpression(e) ? e.expression : e;
    return t.isCallExpression(x) && t.isIdentifier(x.expression) ? x.expression.text : null;
  };
  const visit = (node) => {
    if (t.isExpressionStatement(node) && names.includes(callee(node.expression))) {
      let target = node;
      // `if (x) await emit(…)` / `for (…) await emit(…)`: remove the whole statement, not just its body.
      while (
        target.parent &&
        ((t.isIfStatement(target.parent) &&
          target.parent.thenStatement === target &&
          !target.parent.elseStatement) ||
          ((t.isForOfStatement(target.parent) ||
            t.isForStatement(target.parent) ||
            t.isForInStatement(target.parent) ||
            t.isWhileStatement(target.parent)) &&
            target.parent.statement === target))
      ) {
        target = target.parent;
      }
      ranges.push([target.getStart(sf), target.getEnd()]);
      return;
    }
    if (
      t.isCallExpression(node) &&
      t.isIdentifier(node.expression) &&
      names.includes(node.expression.text) &&
      !ranges.some(([s, e]) => node.getStart(sf) >= s && node.getEnd() <= e)
    ) {
      left.push(`${rel}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`);
    }
    t.forEachChild(node, visit);
  };
  visit(sf);
  let out = ranges.length ? cut(text, ranges) : text;
  if (ranges.length) out = removeUnusedNamedImports(rel, out, names);
  return { text: out, left, removed: ranges.length };
}

/** After removing calls: drop `name` from `import { name, other } from '…'` when it is no longer used. */
function removeUnusedNamedImports(rel, text, names) {
  const t = loadTs();
  const sf = sourceOf(rel, text);
  const ranges = [];
  for (const stmt of sf.statements) {
    if (
      !t.isImportDeclaration(stmt) ||
      !stmt.importClause?.namedBindings ||
      !t.isNamedImports(stmt.importClause.namedBindings)
    )
      continue;
    const els = stmt.importClause.namedBindings.elements;
    const dead = els.filter((e) => names.includes(e.name.text) && !isUsed(sf, e.name.text, stmt));
    if (dead.length === 0) continue;
    if (dead.length === els.length && !stmt.importClause.name)
      ranges.push([stmt.getStart(sf), stmt.getEnd()]);
    else for (const d of dead) ranges.push([d.getStart(sf), d.getEnd()]);
  }
  return ranges.length ? cut(text, ranges) : text;
}

function isUsed(sf, name, except) {
  const t = loadTs();
  let used = false;
  const visit = (n) => {
    if (n === except || used) return;
    if (t.isIdentifier(n) && n.text === name) used = true;
    t.forEachChild(n, visit);
  };
  visit(sf);
  return used;
}

// ---------------------------------------------------------------------------------------------
// The steps. Each returns a list of human-readable lines about what it changed.

function detectScope(tree) {
  const core = JSON.parse(tree.read('packages/core/package.json'));
  return core.name.replace(/\/core$/, '');
}

function renameScope(tree, from, to) {
  if (from === to) return [];
  const re = new RegExp(
    `(?<![\\w@/.-])${from.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')}(?![\\w-])`,
    'g',
  );
  const notes = [];
  let count = 0;
  for (const rel of tree.files()) {
    if (SELF.has(rel) || rel === 'pnpm-lock.yaml' || !isText(rel)) continue;
    const text = tree.read(rel);
    if (!re.test(text)) continue;
    re.lastIndex = 0;
    if (tree.write(rel, text.replace(re, to))) count++;
  }
  if (count) notes.push(`scope ${from} → ${to} in ${count} file(s)`);
  return notes;
}

function setNames(tree, { name, slug }) {
  const notes = [];
  const edit = (rel, fn, what) => {
    if (!tree.exists(rel)) return;
    const before = tree.read(rel);
    const after = fn(before);
    if (after !== before && tree.write(rel, after)) notes.push(what);
  };
  edit(
    'apps/web/lib/site.ts',
    (s) => s.replace(/(name:\s*)(['"])[^'"]*\2/, `$1'${name.replace(/'/g, "\\'")}'`),
    `display name in apps/web/lib/site.ts → "${name}"`,
  );
  edit(
    'packages/ui/src/components/logo.tsx',
    (s) => s.replace(/(name\s*=\s*)(['"])[^'"]*\2/, `$1'${name.replace(/'/g, "\\'")}'`),
    `logo default name → "${name}"`,
  );
  edit(
    '.env.example',
    (s) => s.replace(/^APP_NAME=.*$/m, `APP_NAME=${name}`),
    `APP_NAME in .env.example`,
  );
  edit(
    'package.json',
    (s) => {
      const j = JSON.parse(s);
      j.name = slug;
      return `${JSON.stringify(j, null, 2)}\n`;
    },
    `root package name → ${slug}`,
  );
  edit('README.md', (s) => s.replace(/^# .*$/m, `# ${name}`), `README title → "${name}"`);
  // Database names in the local stack and docs follow the slug (postgres://…/app → …/<slug>).
  const dbName = slug.replace(/-/g, '_');
  for (const rel of [
    '.env.example',
    'docker-compose.yml',
    '.devcontainer/devcontainer.json',
    '.devcontainer/docker-compose.yml',
    'docs/testing.md',
    'docs/deploy.md',
    '.github/workflows/ci.yml',
    '.claude/hooks/session-start.sh',
  ]) {
    edit(
      rel,
      (s) =>
        s
          .replace(/(localhost:5432|@db:5432)\/app\b/g, `$1/${dbName}`)
          .replace(/POSTGRES_DB: app\b/g, `POSTGRES_DB: ${dbName}`)
          .replace(/-d app\b/g, `-d ${dbName}`)
          .replace(/^(DB_NAME=)app$/m, `$1${dbName}`),
      `database name app → ${dbName} in ${rel}`,
    );
  }
  return notes;
}

const PROVIDERS = {
  neon: {
    files: [
      'apps/web/lib/auth/neon.ts',
      'apps/web/lib/auth/neon.test.ts',
      'apps/web/app/api/auth',
      'packages/db/migrations-provider/neon',
    ],
    deps: ['@neondatabase/auth'],
    env: /^# Neon \(BACKEND=neon\)\n(?:[A-Z_]+=.*\n)+\n?/m,
    turboEnv: ['NEON_*'],
  },
  supabase: {
    files: [
      'apps/web/lib/auth/supabase.ts',
      'apps/web/lib/auth/supabase.test.ts',
      'packages/db/migrations-provider/supabase',
    ],
    deps: ['@supabase/ssr'],
    env: /^# Supabase \(BACKEND=supabase\)\n(?:[A-Z_]+=.*\n)+\n?/m,
    turboEnv: ['SUPABASE_*'],
  },
};

function authIndex(keep) {
  const factory =
    keep === 'neon'
      ? `return (await import('./neon')).neonAdapter();`
      : `return (await import('./supabase')).supabaseAdapter();`;
  const configured =
    keep === 'neon'
      ? `Boolean(process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET)`
      : `Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)`;
  return `import 'server-only';

import { devAdapter, devLoginEnabled } from './dev';
import type { AuthAdapter } from './types';

export * from './types';

/** The sign-in provider this project uses (${keep}). docs/choosing-a-backend.md. */
export async function getAuthAdapter(): Promise<AuthAdapter | null> {
  if (devLoginEnabled()) return devAdapter;
  if (!authConfigured()) return null;
  ${factory}
}

/** Is a sign-in provider configured at all? Without one the site still works; sign-in is just unavailable. */
export function authConfigured(): boolean {
  if (devLoginEnabled()) return true;
  return ${configured};
}
`;
}

function chooseBackend(tree, keep) {
  const drop = keep === 'neon' ? 'supabase' : 'neon';
  const notes = [];
  const p = PROVIDERS[drop];
  for (const f of p.files) if (tree.remove(f)) notes.push(`removed ${f}`);

  const indexRel = 'apps/web/lib/auth/index.ts';
  if (tree.exists(indexRel)) {
    const current = tree.read(indexRel);
    const next = authIndex(keep);
    if (current !== next && (current.includes(`'./${drop}'`) || current.includes('BACKEND'))) {
      tree.write(indexRel, next);
      notes.push(`lib/auth/index.ts now returns the ${keep} adapter only`);
    }
  }
  const webPkg = 'apps/web/package.json';
  if (tree.exists(webPkg)) {
    const j = JSON.parse(tree.read(webPkg));
    let changed = false;
    for (const dep of p.deps) {
      for (const k of ['dependencies', 'devDependencies'])
        if (j[k]?.[dep]) {
          delete j[k][dep];
          changed = true;
        }
    }
    if (changed && tree.write(webPkg, `${JSON.stringify(j, null, 2)}\n`))
      notes.push(`removed ${p.deps.join(', ')} from apps/web/package.json`);
  }
  if (tree.exists('.env.example')) {
    let s = tree.read('.env.example');
    const before = s;
    s = s
      .replace(p.env, '')
      .replace(/^BACKEND=.*$/m, `BACKEND=${keep}            # ${keep} (the only provider left)`);
    if (s !== before && tree.write('.env.example', s))
      notes.push(`.env.example: ${drop} block removed, BACKEND=${keep}`);
  }
  if (tree.exists('turbo.json')) {
    const s = tree.read('turbo.json');
    const next = p.turboEnv
      .reduce((acc, v) => acc.replace(new RegExp(`\\s*"${v.replace('*', '\\*')}",?`, 'g'), ''), s)
      .replace(/,(\s*\])/g, '$1');
    if (next !== s && tree.write('turbo.json', next))
      notes.push(`turbo.json: ${p.turboEnv.join(', ')} removed`);
  }
  // Where BACKEND is spelled out as the default.
  for (const rel of [
    '.github/workflows/ci.yml',
    'apps/web/playwright.config.ts',
    '.devcontainer/devcontainer.json',
  ]) {
    if (!tree.exists(rel)) continue;
    const s = tree.read(rel);
    const next = s.replace(new RegExp(`(BACKEND['"]?:\\s*['"]?)${drop}\\b`, 'g'), `$1${keep}`);
    if (next !== s && tree.write(rel, next)) notes.push(`${rel}: BACKEND=${keep}`);
  }
  return notes;
}

function removeModule(tree, id) {
  const mod = MODULES[id];
  const notes = [];
  for (const f of mod.delete) if (tree.remove(f)) notes.push(`removed ${f}`);
  const manual = [];
  for (const d of mod.drop) {
    if (d.calls) {
      for (const rel of tree
        .files()
        .filter((f) => f.startsWith(`${d.file}/`) && /\.tsx?$/.test(f))) {
        const r = removeCalls(rel, tree.read(rel), d.calls, d.from);
        manual.push(...r.left);
        if (r.removed && tree.write(rel, r.text))
          notes.push(`${rel}: removed ${r.removed} ${d.calls.join('/')}() call(s)`);
      }
      continue;
    }
    if (!tree.exists(d.file)) continue;
    let text = tree.read(d.file);
    const before = text;
    if (d.lines) {
      const lines = text.split('\n');
      const keep = [];
      for (let i = 0; i < lines.length; i++) {
        if (d.lines.test(lines[i])) {
          i += d.followLines ?? 0;
          continue;
        }
        keep.push(lines[i]);
      }
      text = keep.join('\n');
    }
    if (d.jsonKeys) {
      const j = JSON.parse(text);
      for (const keys of d.jsonKeys) {
        let o = j;
        for (const k of keys.slice(0, -1)) o = o?.[k];
        if (o && keys.at(-1) in o) delete o[keys.at(-1)];
      }
      text = `${JSON.stringify(j, null, 2)}\n`;
    }
    if (d.scriptsRegex) {
      const j = JSON.parse(text);
      for (const [name, re, to] of d.scriptsRegex)
        if (j.scripts?.[name]) j.scripts[name] = j.scripts[name].replace(re, to);
      text = `${JSON.stringify(j, null, 2)}\n`;
    }
    for (const [re, to] of d.replace ?? []) text = text.replace(re, to);
    if (d.arrayItems) text = removeArrayItems(d.file, text, d.arrayItems);
    if (d.jsx) text = removeJsxByHref(d.file, text, d.jsx);
    if (text !== before && tree.write(d.file, text)) notes.push(`edited ${d.file}`);
  }
  return { notes, manual };
}

/** Remaining imports of what a module owned (its folders, its tables): where you must decide what to do. */
function findLeftovers(tree, id) {
  const spec = MODULES[id].leftovers;
  if (!spec) return [];
  const t = loadTs();
  const found = [];
  for (const rel of tree.files().filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts'))) {
    const text = tree.read(rel);
    if (!/\bimport\b/.test(text)) continue;
    const sf = sourceOf(rel, text);
    for (const st of sf.statements) {
      if (!t.isImportDeclaration(st)) continue;
      const from = st.moduleSpecifier.text;
      const names = [];
      const bindings = st.importClause?.namedBindings;
      if (bindings && t.isNamedImports(bindings))
        names.push(...bindings.elements.map((e) => (e.propertyName ?? e.name).text));
      const hitSpec =
        spec.imports?.test(from) && (from.startsWith('.') || /^@[\w-]+\/core\//.test(from));
      const ours = from.startsWith('.') || /^@[\w-]+\/(db|core)(\/|$)/.test(from);
      const hitName = ours ? names.find((n) => spec.names?.includes(n)) : undefined;
      if (hitSpec || hitName)
        found.push(
          `${rel}:${sf.getLineAndCharacterOfPosition(st.getStart(sf)).line + 1} (${hitSpec ? `imports ${from}` : `uses ${hitName}`})`,
        );
    }
  }
  return found;
}

function addToTodo(tree, answers) {
  const marker = '<!-- new-project:start -->';
  if (!tree.exists('TODO.md')) return [];
  const current = tree.read('TODO.md');
  if (current.includes(marker)) return [];
  const lines = [
    marker,
    `## New project: ${answers.name}`,
    '',
    ...(answers.backend
      ? [
          `- [ ] Create the ${answers.backend === 'neon' ? 'Neon project (database + Neon Auth + Object Storage)' : 'Supabase project (database + Auth + Storage)'} and set its variables: docs/choosing-a-backend.md.`,
        ]
      : []),
    ...(answers.modules.length
      ? [
          `- [ ] Removed modules: ${answers.modules.join(', ')}. Run \`pnpm db:generate --name remove_modules\` if you did not, review the migration, then \`pnpm check\`.`,
        ]
      : []),
    '- [ ] Set the brand ramp (`--brand-50 … --brand-900` in `packages/ui/src/styles/globals.css`) and replace the logo.',
    '- [ ] Rewrite README.md, the intro of AGENTS.md and docs/decisions.md for this project.',
    '- [ ] Set `OWNER_EMAILS`, run the app, sign in, and confirm you became the owner.',
    '<!-- new-project:end -->',
    '',
  ];
  tree.write('TODO.md', current.replace(/^(# .*\n\n)/, `$1${lines.join('\n')}\n`));
  return ['TODO.md: added the new-project checklist'];
}

// ---------------------------------------------------------------------------------------------

export async function main(argv, log = console.log) {
  const args = parseArgs(argv);
  if (args.flags.has('help')) {
    log(
      readFileSync(fileURLToPath(import.meta.url), 'utf8')
        .split('*/')[0]
        .replace(/^#!.*\n\/\*\*\n?/, '')
        .replace(/^ \* ?/gm, ''),
    );
    return 0;
  }
  if (args.values.modules === 'list') {
    for (const [id, m] of Object.entries(MODULES)) log(`${id.padEnd(12)} ${m.title}`);
    return 0;
  }
  const root = path.resolve(args.values.dir ?? path.join(HERE, '..'));
  const dryRun = args.flags.has('dry-run');
  const opts = {
    name: args.values.name,
    scope: args.values.scope ?? (args.values.name ? `@${kebab(args.values.name)}` : undefined),
    slug: args.values.slug ?? (args.values.name ? kebab(args.values.name) : undefined),
    backend: args.values.backend,
    modules: (args.values.modules ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
  const problems = validate(opts);
  if (problems.length) {
    for (const p of problems) console.error(`error: ${p}`);
    return 2;
  }
  if (!opts.name && !opts.scope && !opts.backend && opts.modules.length === 0) {
    console.error('Nothing to do. Pass --name, --scope, --backend and/or --modules (see --help).');
    return 2;
  }
  loadTs(root);

  const tree = new Tree(root);
  const report = [];
  const manual = [];
  const step = (title, notes) => report.push([title, notes]);

  if (opts.scope) step('Scope', renameScope(tree, detectScope(tree), opts.scope));
  if (opts.name) step('Names', setNames(tree, { name: opts.name, slug: opts.slug }));
  if (opts.backend) step(`Backend: keep ${opts.backend}`, chooseBackend(tree, opts.backend));
  for (const id of opts.modules) {
    const r = removeModule(tree, id);
    manual.push(...r.manual.map((m) => `${id}: a result is used here, remove by hand: ${m}`));
    step(`Module: remove ${id}`, r.notes);
  }
  // After ALL removals, so a file that only referenced two removed modules is not reported twice.
  for (const id of opts.modules) {
    for (const f of findLeftovers(tree, id))
      manual.push(`${id} was removed but this still uses it: ${f}`);
  }
  if (opts.name || opts.backend || opts.modules.length) step('TODO.md', addToTodo(tree, opts));

  log(`${dryRun ? 'Dry run — nothing is written.' : 'Changes'} in ${root}\n`);
  let total = 0;
  for (const [title, notes] of report) {
    log(`${title}`);
    if (notes.length === 0) log('  nothing to do (already done)');
    for (const n of notes) log(`  - ${n}`);
    total += notes.length;
  }
  for (const m of manual) log(`\nNeeds you: ${m}`);
  if (dryRun) {
    log(`\n${total} change(s) planned.`);
    return 0;
  }

  tree.commit();
  const touched = [...tree.changes]
    .filter(([, v]) => v !== null)
    .map(([k]) => k)
    .filter((f) => /\.(tsx?|mjs|json|md|ya?ml|css)$/.test(f));
  const run = (cmd, cmdArgs, what) => {
    log(
      `\n$ ${cmd} ${cmdArgs.length > 12 ? `${cmdArgs.slice(0, 6).join(' ')} … (${cmdArgs.length - 6} more)` : cmdArgs.join(' ')}`,
    );
    const res = spawnSync(cmd, cmdArgs, { cwd: root, stdio: 'inherit' });
    if (res.status !== 0) log(`(${what} failed; fix it and run it yourself)`);
    return res.status === 0;
  };
  if (touched.length && !args.flags.has('no-format')) {
    // `--ignore-unknown` skips files Prettier ignores (generated docs, lockfile).
    for (let i = 0; i < touched.length; i += 100) {
      run(
        'pnpm',
        [
          'exec',
          'prettier',
          '--write',
          '--ignore-unknown',
          '--log-level',
          'warn',
          ...touched.slice(i, i + 100),
        ],
        'format',
      );
    }
  }
  if (total > 0 && !args.flags.has('no-install')) {
    run(
      'pnpm',
      [
        'install',
        ...(args.flags.has('install-offline') ? ['--offline'] : []),
        '--no-frozen-lockfile',
      ],
      'install',
    );
  }
  if (
    opts.modules.includes('automations') &&
    !args.flags.has('no-generate') &&
    !args.flags.has('no-install')
  ) {
    run('pnpm', ['db:generate', '--name', 'remove_modules'], 'migration generate');
  }
  log('\nDone. Next: pnpm check, then the checklist in TODO.md.');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
