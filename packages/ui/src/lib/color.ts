/**
 * Colour maths for checking contrast (used by /brand to print the real ratio of every
 * text-on-surface pair, light and dark). Understands the `oklch(L C H / A)` strings the tokens use,
 * plus `transparent`. Not for runtime theming: components use tokens, never computed colours.
 */

export type Rgb = { r: number; g: number; b: number; a: number };

/** "oklch(0.585 0.2 277 / 0.5)" → sRGB 0–1 (gamut-clipped), with alpha. Null if not understood. */
export function parseColor(input: string): Rgb | null {
  const s = input.trim().toLowerCase();
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const m =
    /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+)(%?))?\s*\)$/.exec(s);
  if (!m) return null;
  const L = Number(m[1]) / (m[2] ? 100 : 1);
  const C = Number(m[3]);
  const H = (Number(m[4]) * Math.PI) / 180;
  const alpha = m[5] === undefined ? 1 : Number(m[5]) / (m[6] ? 100 : 1);
  const a = C * Math.cos(H);
  const b = C * Math.sin(H);
  // OKLab → linear sRGB (Björn Ottosson's matrices).
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const mm = m_ ** 3;
  const ss = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * ss,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * ss,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * ss,
  ].map((v) => Math.min(1, Math.max(0, v)));
  return { r: lin[0]!, g: lin[1]!, b: lin[2]!, a: alpha };
}

/** Composite `top` over an opaque `bottom` (both linear). */
export function over(top: Rgb, bottom: Rgb): Rgb {
  const a = top.a;
  return {
    r: top.r * a + bottom.r * (1 - a),
    g: top.g * a + bottom.g * (1 - a),
    b: top.b * a + bottom.b * (1 - a),
    a: 1,
  };
}

/** WCAG relative luminance of a (linear-light) colour. */
export function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG contrast ratio of text `fg` on surface `bg`. Translucent colours are composited:
 * `bg` over `base` (the page behind it), then `fg` over that. Null if a colour can't be read.
 */
export function contrastRatio(fg: string, bg: string, base = 'oklch(1 0 0)'): number | null {
  const f = parseColor(fg);
  const b = parseColor(bg);
  const w = parseColor(base);
  if (!f || !b || !w) return null;
  const surface = over(b, over(w, { r: 0, g: 0, b: 0, a: 1 }));
  const text = over(f, surface);
  const [hi, lo] = [luminance(text), luminance(surface)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** "AAA" ≥ 7, "AA" ≥ 4.5, "AA large" ≥ 3, otherwise "Fail" (normal text). */
export function wcagLevel(ratio: number): 'AAA' | 'AA' | 'AA large' | 'Fail' {
  return ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA large' : 'Fail';
}
