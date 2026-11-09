/**
 * Tests for scripts/new-project.mjs, on a throw-away copy of this repo:  `pnpm test:scripts`
 *
 *  - a dry run changes nothing
 *  - a real run renames the scope, keeps one provider and removes modules; a second run does nothing
 *  - the result typechecks: every workspace's `tsc`, compared with the same check on an untouched copy,
 *    so only errors THE SCRIPT caused fail this test (pre-existing ones are not its business), and an
 *    error it did cause must be in a file the script itself told you to look at ("Needs you").
 *
 * The typecheck needs the installed dependencies (hard-linked into the copy, so no network) and takes
 * a minute; set NEW_PROJECT_SKIP_TYPECHECK=1 to run only the fast tests.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { main, MODULES } from './new-project.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_TC = process.env.NEW_PROJECT_SKIP_TYPECHECK === '1';
const workspaces = ['apps/web', 'packages/core', 'packages/db', 'packages/ui'];
const made = [];

/** A copy of the repo without .git/.next, with node_modules hard-linked (instant, no install). */
function copyRepo(label) {
  const dir = mkdtempSync(path.join(process.env.NEW_PROJECT_TMP ?? tmpdir(), `np-${label}-`));
  made.push(dir);
  execFileSync('sh', [
    '-c',
    `tar -C "${REPO}" --exclude=node_modules --exclude=.git --exclude=.next --exclude=.next-e2e --exclude=.turbo --exclude=test-results -cf - . | tar -C "${dir}" -xf -`,
  ]);
  if (existsSync(path.join(REPO, 'node_modules'))) {
    execFileSync('cp', ['-al', path.join(REPO, 'node_modules'), path.join(dir, 'node_modules')]);
    for (const ws of workspaces) {
      const nm = path.join(REPO, ws, 'node_modules');
      if (existsSync(nm)) execFileSync('cp', ['-a', nm, path.join(dir, ws, 'node_modules')]);
    }
  }
  return dir;
}

function snapshot(dir) {
  const h = createHash('sha256');
  const walk = (rel) => {
    for (const name of readdirSync(path.join(dir, rel)).sort()) {
      if (['node_modules', '.git', '.next', '.turbo'].includes(name)) continue;
      const r = path.join(rel, name);
      if (statSync(path.join(dir, r)).isDirectory()) walk(r);
      else h.update(r).update(readFileSync(path.join(dir, r)));
    }
  };
  walk('');
  return h.digest('hex');
}

function run(dir, args) {
  const lines = [];
  return main(['--dir', dir, '--no-format', '--install-offline', '--no-generate', ...args], (l) =>
    lines.push(l),
  ).then((code) => ({ code, out: lines.join('\n') }));
}

/** TypeScript errors per workspace as `file|TScode|message` (line numbers dropped: edits shift them). */
function typecheck(dir, scope) {
  const errors = [];
  for (const ws of workspaces) {
    const cmd = ws === 'apps/web' ? 'next typegen >/dev/null 2>&1; tsc --noEmit' : 'tsc --noEmit';
    const res = spawnSync('sh', ['-c', `pnpm exec ${cmd.replace('; ', '; pnpm exec ')}`], {
      cwd: path.join(dir, ws),
      encoding: 'utf8',
    });
    for (const line of `${res.stdout}\n${res.stderr}`.split('\n')) {
      const m = /^(.+?)\(\d+,\d+\): error (TS\d+): (.*)$/.exec(line);
      if (m) errors.push(`${ws}/${m[1]}|${m[2]}|${m[3].replaceAll(scope, '@app')}`);
    }
  }
  return errors;
}

after(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

describe('scripts/new-project.mjs', () => {
  it('lists its modules', async () => {
    const lines = [];
    assert.equal(await main(['--modules', 'list'], (l) => lines.push(l)), 0);
    for (const id of Object.keys(MODULES))
      assert.ok(
        lines.some((l) => l.startsWith(id)),
        id,
      );
  });

  it('rejects bad input without touching anything', async () => {
    const dir = copyRepo('bad');
    const before = snapshot(dir);
    for (const args of [['--scope', 'acme'], ['--backend', 'mysql'], ['--modules', 'nope'], []]) {
      const lines = [];
      const code = await main(['--dir', dir, ...args], (l) => lines.push(l));
      assert.equal(code, 2, JSON.stringify(args));
    }
    assert.equal(snapshot(dir), before);
  });

  it('a dry run writes nothing', async () => {
    const dir = copyRepo('dry');
    const before = snapshot(dir);
    const { code, out } = await run(dir, [
      '--dry-run',
      '--name',
      'Acme Rentals',
      '--scope',
      '@acme',
      '--backend',
      'supabase',
      '--modules',
      'brand,docs',
    ]);
    assert.equal(code, 0);
    assert.match(out, /Dry run/);
    assert.match(out, /scope @app → @acme/);
    assert.equal(snapshot(dir), before);
  });

  it('renames, keeps one provider, removes modules, and is idempotent', async () => {
    const dir = copyRepo('real');
    const args = [
      '--name',
      'Acme Rentals',
      '--scope',
      '@acme',
      '--backend',
      'supabase',
      '--modules',
      'brand',
      '--no-install',
    ];
    const first = await run(dir, args);
    assert.equal(first.code, 0, first.out);

    const read = (rel) => readFileSync(path.join(dir, rel), 'utf8');
    assert.equal(JSON.parse(read('packages/core/package.json')).name, '@acme/core');
    assert.equal(JSON.parse(read('package.json')).name, 'acme-rentals');
    assert.match(read('apps/web/lib/site.ts'), /name: 'Acme Rentals'/);
    assert.ok(!existsSync(path.join(dir, 'apps/web/lib/auth/neon.ts')));
    assert.ok(existsSync(path.join(dir, 'apps/web/lib/auth/supabase.ts')));
    assert.ok(!existsSync(path.join(dir, 'apps/web/app/brand')));
    assert.ok(
      !('@neondatabase/auth' in (JSON.parse(read('apps/web/package.json')).dependencies ?? {})),
    );
    assert.match(read('.env.example'), /^BACKEND=supabase/m);
    assert.doesNotMatch(read('.env.example'), /NEON_AUTH_BASE_URL/);
    assert.doesNotMatch(read('apps/web/lib/auth/index.ts'), /neon/);
    assert.doesNotMatch(read('apps/web/app/sitemap.ts'), /brand/);
    assert.doesNotMatch(read('apps/web/components/site/site-footer.tsx'), /\/brand/);
    // No `@app/` is left outside the tool's own files and its skill.
    // (grep exits 1 when it finds nothing, which is what we want.)
    const leftover = spawnSync(
      'grep',
      [
        '-rIl',
        '--exclude-dir=node_modules',
        '--exclude=pnpm-lock.yaml',
        '--exclude=new-project*',
        '--exclude=SKILL.md',
        '@app/',
        '.',
      ],
      { cwd: dir, encoding: 'utf8' },
    )
      .stdout.split('\n')
      .filter(Boolean);
    assert.deepEqual(leftover, []);

    const after1 = snapshot(dir);
    const second = await run(dir, args);
    assert.equal(second.code, 0);
    assert.doesNotMatch(second.out, /^ {2}- /m, `the second run changed something:\n${second.out}`);
    assert.equal(snapshot(dir), after1);
  });

  it(
    'the result typechecks: no new errors, and any it causes are ones it reported',
    { skip: SKIP_TC, timeout: 900_000 },
    async () => {
      const baseline = typecheck(copyRepo('base'), '@app');

      const dir = copyRepo('tc');
      const { code, out } = await run(dir, [
        '--name',
        'Acme Rentals',
        '--scope',
        '@acme',
        '--backend',
        'supabase',
        '--modules',
        'brand,docs,automations',
      ]);
      assert.equal(code, 0, out);
      const reported = [...out.matchAll(/this still uses it: ([^\s:]+):\d+/g)].map((m) => m[1]);

      const known = new Map();
      for (const e of baseline) known.set(e, (known.get(e) ?? 0) + 1);
      const fresh = [];
      for (const e of typecheck(dir, '@acme')) {
        if ((known.get(e) ?? 0) > 0) known.set(e, known.get(e) - 1);
        else fresh.push(e);
      }
      const unexplained = fresh.filter(
        (e) => !reported.some((f) => e.startsWith(`${f}|`) || e.includes(`/${f}|`)),
      );
      assert.deepEqual(
        unexplained,
        [],
        `errors the script caused and did not report:\n${unexplained.join('\n')}`,
      );
    },
  );
});
