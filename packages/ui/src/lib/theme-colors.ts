/**
 * The few places that need a colour as a literal string rather than a CSS class:
 * web app manifests and the <meta name="theme-color"> tag. Keep these in step with
 * `--brand-500` etc. in ../styles/globals.css.
 */
export const THEME_COLORS = {
  /** Cardinal Orange, --brand-500. Store + customer portal. */
  brand: '#e5542f',
  /** Near-black chrome for the staff apps (admin, POS). */
  staff: '#171717',
  /** Manifest splash background; also the signature pad's paper (signatures are always ink on white). */
  background: '#ffffff',
  /** Signature ink: dark blue-black, like a pen, on white in light and dark mode alike. */
  ink: '#1e293b',
} as const;
