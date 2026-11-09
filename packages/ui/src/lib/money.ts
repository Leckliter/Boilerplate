/**
 * Money is always integer cents in storage and in actions. These two helpers are the only place
 * cents become text and text becomes cents.
 */

export interface FormatMoneyOptions {
  /** ISO 4217 code. Default "USD". */
  currency?: string;
  /** BCP 47 locale. Default "en-US". */
  locale?: string;
  /** Drop ".00" on whole amounts: $49 instead of $49.00. */
  trimZeros?: boolean;
}

const cache = new Map<string, Intl.NumberFormat>();
function nf(locale: string, currency: string, trim: boolean): Intl.NumberFormat {
  const key = `${locale}|${currency}|${trim}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      ...(trim ? { minimumFractionDigits: 0 } : {}),
    });
    cache.set(key, f);
  }
  return f;
}

/** 4900 → "$49.00", -1250 → "-$12.50". Non-finite or missing → "—". */
export function formatMoney(
  cents: number | null | undefined,
  { currency = 'USD', locale = 'en-US', trimZeros = false }: FormatMoneyOptions = {},
): string {
  if (cents == null || !Number.isFinite(cents)) return '—';
  const whole = Number.isInteger(cents / 100);
  return nf(locale, currency, trimZeros && whole).format(Math.round(cents) / 100);
}

/**
 * What a person typed → integer cents, or null when it is not an amount.
 * "49", "$49.00", "1,234.5", "(12.50)" and "-12.5" are understood; more than two decimals are
 * rejected rather than silently rounded.
 */
export function parseMoneyToCents(input: string | null | undefined): number | null {
  if (input == null) return null;
  let s = input.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  s = s.replace(/^[-−]/, () => {
    negative = !negative;
    return '';
  });
  s = s.replace(/^\$\s*/, '').replace(/,/g, '');
  const m = /^(\d+)(?:\.(\d{1,2}))?$|^\.(\d{1,2})$/.exec(s);
  if (!m) return null;
  const dollars = Number(m[1] ?? 0);
  const frac = (m[2] ?? m[3] ?? '').padEnd(2, '0');
  const cents = dollars * 100 + Number(frac || 0);
  if (!Number.isSafeInteger(cents)) return null;
  return negative && cents ? -cents : cents;
}

/** Alias of {@link parseMoneyToCents} (the name the docs use). */
export const parseMoney = parseMoneyToCents;
