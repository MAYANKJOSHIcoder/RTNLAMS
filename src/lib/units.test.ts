import { describe, it, expect } from 'vitest';
import { toHectares, fromHectares, formatArea, AREA_UNITS } from './units';

describe('units', () => {
  it('has the 5 locked units', () => {
    expect(AREA_UNITS).toEqual(['sqm', 'sqft', 'gaj', 'acre', 'hectare']);
  });

  it('converts to hectares exactly', () => {
    expect(toHectares(10_000, 'sqm')).toBe(1);
    expect(toHectares(1, 'hectare')).toBe(1);
    expect(toHectares(2, 'acre')).toBeCloseTo(0.80937128, 8);
    expect(toHectares(1, 'gaj')).toBeCloseTo(0.000083612736, 12);
    expect(toHectares(100, 'sqft')).toBeCloseTo(0.0009290304, 9);
  });

  it('round-trips every unit', () => {
    for (const u of AREA_UNITS) {
      expect(fromHectares(toHectares(1.234, u), u)).toBeCloseTo(1.234, 10);
    }
  });

  it('formats for display', () => {
    expect(formatArea(1, 'hectare')).toBe('1 hectare');
    expect(formatArea(0.40468564224, 'acre')).toBe('1 acre');
    expect(formatArea(null, 'gaj')).toBe('-');
    expect(formatArea(0.000083612736, 'gaj')).toBe('1 gaj (sq yd)');
  });
});
