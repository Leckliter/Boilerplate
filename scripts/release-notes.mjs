#!/usr/bin/env node
/**
 * Release notes from commit subjects: `node scripts/release-notes.mjs v1.2.0 > notes.md`.
 * Covers the commits between the previous `v*` tag and the given tag (or HEAD). Subjects that start
 * with a conventional prefix (`feat:`, `fix(scope):` …) are grouped; everything else goes under
 * "Other changes". Merge commits are skipped. Used by .github/workflows/release.yml.
 */
import { execFileSync } from 'node:child_process';

const GROUPS = [
  ['feat', 'Features'],
  ['fix', 'Fixes'],
  ['perf', 'Performance'],
  ['docs', 'Documentation'],
  ['refactor', 'Refactoring'],
  ['test', 'Tests'],
  ['chore', 'Chores'],
  ['ci', 'CI and deploy'],
  ['build', 'CI and deploy'],
];

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

/** `feat(ui): add a thing` -> { type: 'feat', text: 'ui: add a thing' } */
export function parseSubject(subject) {
  const m = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/.exec(subject);
  if (!m || !GROUPS.some(([t]) => t === m[1])) return { type: 'other', text: subject };
  return { type: m[1], text: m[2] ? `${m[2]}: ${m[4]}` : m[4], breaking: Boolean(m[3]) };
}

export function renderNotes({ tag, previous, commits, repoUrl }) {
  const buckets = new Map();
  const breaking = [];
  for (const { sha, subject } of commits) {
    const { type, text, breaking: isBreaking } = parseSubject(subject);
    const title = GROUPS.find(([t]) => t === type)?.[1] ?? 'Other changes';
    const line = `- ${text} (${sha.slice(0, 7)})`;
    if (isBreaking) breaking.push(line);
    buckets.set(title, [...(buckets.get(title) ?? []), line]);
  }
  const out = [`## ${tag}`, ''];
  if (breaking.length) out.push('### Breaking changes', '', ...breaking, '');
  for (const title of new Set([...GROUPS.map(([, t]) => t), 'Other changes'])) {
    const lines = buckets.get(title);
    if (lines) out.push(`### ${title}`, '', ...lines, '');
  }
  if (commits.length === 0) out.push('No changes since the previous release.', '');
  if (repoUrl && previous)
    out.push(`**Full changelog**: ${repoUrl}/compare/${previous}...${tag}`, '');
  return out.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const tag = process.argv[2] ?? 'HEAD';
  const end = tag === 'HEAD' ? 'HEAD' : tag;
  let previous = '';
  try {
    previous = git('describe', '--tags', '--abbrev=0', '--match', 'v*', `${end}^`);
  } catch {
    // Expected: the first release has no previous tag, so the notes cover the whole history.
  }
  const range = previous ? `${previous}..${end}` : end;
  const log = git('log', '--no-merges', '--pretty=format:%H%x09%s', range);
  const commits = log
    ? log.split('\n').map((l) => {
        const [sha, ...rest] = l.split('\t');
        return { sha, subject: rest.join('\t') };
      })
    : [];
  let repoUrl = '';
  try {
    repoUrl = git('remote', 'get-url', 'origin')
      .replace(/^git@github\.com:/, 'https://github.com/')
      .replace(/\.git$/, '');
  } catch {
    // Expected: no remote (a local run): skip the compare link.
  }
  process.stdout.write(renderNotes({ tag, previous, commits, repoUrl }));
}
