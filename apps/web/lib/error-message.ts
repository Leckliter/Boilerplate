/**
 * The text of an action failure without the trailing " Error reference: E-XXXXXXXX".
 * Actions put the reference in the message so REST and MCP callers see it; screens show it once
 * on its own (a copy-able reference box or a toast action), so they strip it from the sentence.
 */
export function withoutReference(message: string, ref?: string | null): string {
  if (!ref) return message;
  return message
    .replace(new RegExp(`\\s*Error reference:\\s*${ref}\\.?`, 'g'), '')
    .replace(/\s+$/, '')
    .trim();
}
