#!/usr/bin/env node
/**
 * PostToolUse: run Prettier on the file Claude just edited, so formatting never
 * fails `pnpm check` / CI. Never blocks; a file Prettier can't parse is left alone
 * (typecheck/lint will say why).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

try {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  const file = input.tool_input?.file_path;
  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  if (file && /\.(ts|tsx|mts|mjs|js|jsx|json|md|css|ya?ml)$/.test(file)) {
    const bin = path.join(root, 'node_modules', '.bin', 'prettier');
    execFileSync(bin, ['--write', '--ignore-unknown', '--log-level', 'silent', file], {
      cwd: root,
      stdio: 'ignore',
      timeout: 20_000,
    });
  }
} catch {
  // Formatting is a convenience: `pnpm format` in pnpm check still catches anything missed.
}
process.exit(0);
