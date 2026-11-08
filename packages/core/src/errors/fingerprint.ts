import { createHash } from 'node:crypto';

/** Stable across occurrences: ids, numbers and quoted values are ignored, as are line numbers. */
export function fingerprint(
  code: string,
  name: string,
  message: string,
  stack: string | null,
  action?: string,
): string {
  const normalised = message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/"[^"]*"|'[^']*'|“[^”]*”/g, '<value>')
    .replace(/\b\d+\b/g, '<n>');
  const frame =
    stack
      ?.split('\n')
      .find((l) => /^\s+at /.test(l) && !/node_modules|node:|\(native\)/.test(l))
      ?.trim()
      .replace(/:\d+:\d+\)?$/, '') ?? '';
  return createHash('sha256')
    .update([code, name, normalised, frame, action ?? ''].join('|'))
    .digest('hex')
    .slice(0, 16);
}
