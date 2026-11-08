/** Keys whose values never reach a log or error report. */
const SECRET_KEY = /pass|secret|token|key$|authorization|otp|code|card|cvc|ssn|license/i;
const MAX_JSON = 20_000;

/** Copy of `value` with secret-looking keys replaced by "[redacted]", capped in size. */
export function redact(value: unknown): unknown {
  const out = strip(value);
  const json = JSON.stringify(out) ?? 'null';
  return json.length > MAX_JSON ? { truncated: true, preview: json.slice(0, 2_000) } : out;
}

function strip(value: unknown, depth = 0): unknown {
  if (value === undefined) return null;
  if (!value || typeof value !== 'object') return value;
  if (depth > 8) return '[too deep]';
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => strip(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k,
      SECRET_KEY.test(k) ? '[redacted]' : strip(v, depth + 1),
    ]),
  );
}
