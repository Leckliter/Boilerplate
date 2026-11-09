import { describe, expect, it } from 'vitest';

import { BRAND_STEPS, brandRamp, hexToOklch, rampCss } from './brand-ramp';

describe('hexToOklch', () => {
  it('rejects anything but a 6-digit hex', () => {
    expect(hexToOklch('red')).toBeNull();
    expect(hexToOklch('#abc')).toBeNull();
    expect(hexToOklch('#12345g')).toBeNull();
  });

  it('knows white, black and a saturated colour', () => {
    expect(hexToOklch('#ffffff')!.l).toBeCloseTo(1, 2);
    expect(hexToOklch('#000000')!.l).toBeCloseTo(0, 2);
    const blue = hexToOklch('#0000ff')!;
    expect(blue.h).toBeGreaterThan(255);
    expect(blue.h).toBeLessThan(270);
    expect(blue.c).toBeGreaterThan(0.25);
  });
});

describe('brandRamp', () => {
  it('has ten steps that keep the hue and get darker', () => {
    const ramp = brandRamp('#5b5bd6')!;
    expect(Object.keys(ramp)).toHaveLength(BRAND_STEPS.length);
    const lightness = BRAND_STEPS.map((s) => Number(/oklch\(([\d.]+) /.exec(ramp[s])![1]));
    expect([...lightness].sort((a, b) => b - a)).toEqual(lightness);
    const hues = new Set(BRAND_STEPS.map((s) => /oklch\([\d.]+ [\d.]+ (\d+)\)/.exec(ramp[s])![1]));
    expect(hues.size).toBe(1);
  });

  it('is null for an invalid colour, and prints paste-ready CSS', () => {
    expect(brandRamp('nope')).toBeNull();
    const css = rampCss(brandRamp('#ff6600')!);
    expect(css.split('\n')).toHaveLength(10);
    expect(css).toContain('--brand-500: oklch(');
  });
});
