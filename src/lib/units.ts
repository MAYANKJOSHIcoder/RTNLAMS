/**
 * Area units — Indian land measurement. DB stores canonical hectares;
 * converts on input and display. Conversions are legally exact.
 */
export type AreaUnit = 'sqm' | 'sqft' | 'gaj' | 'acre' | 'hectare';

// sq metres per unit (gaj = square yard)
export const SQM_PER_UNIT: Record<AreaUnit, number> = {
  sqm: 1,
  sqft: 0.09290304,
  gaj: 0.83612736,
  acre: 4046.8564224,
  hectare: 10_000,
};

export const UNIT_LABELS: Record<AreaUnit, string> = {
  sqm: 'sq m',
  sqft: 'sq ft',
  gaj: 'gaj (sq yd)',
  acre: 'acre',
  hectare: 'hectare',
};

export const AREA_UNITS = Object.keys(SQM_PER_UNIT) as AreaUnit[];

export function toHectares(value: number, unit: AreaUnit): number {
  return (value * SQM_PER_UNIT[unit]) / 10_000;
}

export function fromHectares(hectares: number, unit: AreaUnit): number {
  return (hectares * 10_000) / SQM_PER_UNIT[unit];
}

// Display helper: 2 decimals, trims trailing zeros
export function formatArea(hectares: number | null | undefined, unit: AreaUnit): string {
  if (hectares == null) return '-';
  const v = fromHectares(Number(hectares), unit);
  const rounded = Math.round(v * 100) / 100;
  return `${rounded.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${UNIT_LABELS[unit]}`;
}
