import { describe, expect, it } from 'vitest';

import { contrastRatio, parseColor, wcagLevel } from '../src/lib/color';

describe('colour maths', () => {
  it('reads oklch with and without alpha', () => {
    expect(parseColor('oklch(1 0 0)')).toMatchObject({ r: 1, g: 1, b: 1, a: 1 });
    expect(parseColor('oklch(0 0 0 / 0.5)')).toMatchObject({ a: 0.5 });
    expect(parseColor('transparent')?.a).toBe(0);
    expect(parseColor('#fff')).toBeNull();
  });
  it('gives the textbook ratios for black on white', () => {
    expect(contrastRatio('oklch(0 0 0)', 'oklch(1 0 0)')).toBeCloseTo(21, 0);
    expect(contrastRatio('oklch(1 0 0)', 'oklch(1 0 0)')).toBeCloseTo(1, 5);
  });
  it('composites a translucent surface over the page', () => {
    const solid = contrastRatio('oklch(0.2 0 0)', 'oklch(0.9 0 0)')!;
    const half = contrastRatio('oklch(0.2 0 0)', 'oklch(0.9 0 0 / 0.5)')!;
    expect(half).toBeLessThan(solid + 5);
    expect(half).toBeGreaterThan(1);
  });
  it('names the WCAG level', () => {
    expect(wcagLevel(8)).toBe('AAA');
    expect(wcagLevel(4.6)).toBe('AA');
    expect(wcagLevel(3.2)).toBe('AA large');
    expect(wcagLevel(2)).toBe('Fail');
  });
});
