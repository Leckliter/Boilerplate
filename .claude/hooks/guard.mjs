#!/usr/bin/env node
/**
 * PreToolUse guard: stops the few mistakes that are hard to undo, before they happen.
 * Exit code 2 blocks the tool call and shows the reason to Claude.
 *
 * - Bash: migrations/seeds/SQL/drizzle push against anything but a local database;
 *   force-pushing or deleting main/dev; skipping git hooks.
 * - Edit/Write: applied migrations (rule 5) and generated files (regenerate instead).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const tool = input.tool_name;
const args = input.tool_input ?? {};
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();

function block(reason) {
  process.stderr.write(`Blocked by .claude/hooks/guard.mjs: ${reason}\n`);
  process.exit(2);
}

const LOCAL = /@(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//;
const HOSTED = /supabase\.(co|com)|pooler\.supabase|neon\.tech|\.neon\.|\.vercel|amazonaws\.com/;

if (tool === 'Bash') {
  const cmd = String(args.command ?? '');
  const touchesDb =
    /\b(db:migrate|db:seed|db:studio|drizzle-kit\s+(push|migrate|drop)|psql|pg_dump|pg_restore)\b/.test(
      cmd,
    ) || /\bscripts\/(migrate|seed)\.ts\b/.test(cmd);
  if (touchesDb) {
    // Which database? An inline DATABASE_URL=… / postgres URL in the command wins, else the env.
    const inline = cmd.match(/postgres(?:ql)?:\/\/\S+/g) ?? [];
    const envUrl = process.env.DATABASE_URL ?? '';
    const urls = inline.length ? inline : envUrl ? [envUrl] : [];
    const remote = urls.find((u) => !LOCAL.test(u) || HOSTED.test(u));
    if (remote || HOSTED.test(cmd)) {
      block(
        'database commands only run against a local Postgres in a session. Hosted databases are ' +
          'migrated by the deploy (docs/testing.md); never run SQL or migrations on them by hand (rules 5 and 10).',
      );
    }
  }
  if (/\bgit\s+push\b/.test(cmd)) {
    if (
      /(--force\b|--force-with-lease\b|\s-f\b|\s\+\S*(main|dev)\b)/.test(cmd) &&
      /\b(main|dev)\b/.test(cmd)
    ) {
      block('never force-push main or dev — they are the deployed sites.');
    }
    if (/--delete\b.*\b(main|dev)\b|\s:(main|dev)\b/.test(cmd)) block('never delete main or dev.');
  }
  if (/\bgit\s+(commit|push)\b.*--no-verify\b/.test(cmd)) {
    block('don’t skip checks with --no-verify — fix what they report.');
  }
  process.exit(0);
}

if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
  const file = String(args.file_path ?? args.notebook_path ?? '');
  const rel = path.relative(root, path.resolve(root, file)).split(path.sep).join('/');

  if (/\.generated\.(ts|md)$/.test(rel)) {
    block(
      `${rel} is generated — don't edit it. Change the source and run ` +
        (rel.includes('actions')
          ? '`pnpm actions:docs`.'
          : 'its generator (see package.json scripts).'),
    );
  }

  if (/^packages\/db\/migrations\/.+\.sql$/.test(rel) && existsSync(path.join(root, rel))) {
    let applied = false;
    try {
      execFileSync('git', ['cat-file', '-e', `origin/main:${rel}`], { cwd: root, stdio: 'ignore' });
      applied = true;
    } catch {
      // Not on origin/main (a new migration on this branch) — or no origin/main: allow.
    }
    if (applied) {
      block(
        `${rel} is already on main, so the hosted databases have run it. Never edit an applied ` +
          'migration — change the schema and run `pnpm db:generate` for a new one (rule 5, skill add-migration).',
      );
    }
  }
}
process.exit(0);
