/**
 * The few places that need a colour as a literal string rather than a CSS class:
 * web app manifests and the <meta name="theme-color"> tag. These are the ONLY literal
 * colours outside globals.css; keep them in step with `--brand-500` and `--background`.
 * (rules-ok: colour — documented token mirror)
 */
export const THEME_COLORS = {
  /** Mirrors --brand-500 (indigo default). */
  brand: '#5b5bd6',
  /** Near-black chrome for staff/admin surfaces. */
  staff: '#171717',
  /** Manifest splash background. */
  background: '#ffffff',
} as const;
