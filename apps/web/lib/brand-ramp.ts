/**
 * Brand ramp generator for Settings → General. Takes the colour an owner picked (a hex) and produces the ten
 * `--brand-50 … --brand-900` steps docs/design-system.md describes: keep the hue, step lightness from ~96% down
 * to ~32%, ease the chroma toward both ends. This is the one place the app computes colours: it exists to hand
 * the owner CSS to paste into packages/ui/src/styles/globals.css (nothing here styles the running app).
 */
export const BRAND_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export type BrandStep = (typeof BRAND_STEPS)[number];

/** Lightness per step, and how much of the base chroma each step keeps (the neutral default ramp's shape). */
const LIGHTNESS = [0.962, 0.93, 0.87, 0.79, 0.7, 0.56, 0.51, 0.45, 0.38, 0.32];
const CHROMA_SHARE = [0.09, 0.17, 0.33, 0.55, 0.8, 1, 1.05, 0.95, 0.75, 0.55];

export const HEX = /^#[0-9a-f]{6}$/i;

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** "#4f46e5" → { l, c, h } in OKLCH (Björn Ottosson's OKLab). Null when it is not a 6-digit hex. */
export function hexToOklch(hex: string): { l: number; c: number; h: number } | null {
  if (!HEX.test(hex)) return null;
  const [r, g, b] = [1, 3, 5].map((i) => srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255)) as [
    number,
    number,
    number,
  ];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
}

/** The ten steps as CSS colour strings, keyed by step. Null for an invalid hex. */
export function brandRamp(hex: string): Record<BrandStep, string> | null {
  const base = hexToOklch(hex);
  if (!base) return null;
  const chroma = Math.min(0.22, Math.max(0.03, base.c));
  const hue = Math.round(base.h);
  return Object.fromEntries(
    BRAND_STEPS.map((step, i) => [
      step,
      // rules-ok: no-raw-colour — the generator's whole job is to emit oklch() values for the owner's colour
      `oklch(${LIGHTNESS[i]} ${(chroma * CHROMA_SHARE[i]!).toFixed(3)} ${hue})`,
    ]),
  ) as Record<BrandStep, string>;
}

/** The CSS to paste into globals.css. */
export function rampCss(ramp: Record<BrandStep, string>): string {
  return BRAND_STEPS.map((s) => `  --brand-${s}: ${ramp[s]};`).join('\n');
}

/** Inline style that re-points the brand tokens inside one element (the preview), without touching the page. */
export function rampStyle(ramp: Record<BrandStep, string>): Record<string, string> {
  return {
    ...Object.fromEntries(BRAND_STEPS.map((s) => [`--brand-${s}`, ramp[s]])),
    '--primary': 'var(--brand-500)',
  };
}
