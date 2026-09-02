/**
 * Compensation Calculator — PROMPT 16
 * Formula: awarded = circleRatePerSqm * areaSqm * marketMultiplier * landUseMultiplier * (1 - depreciation + upgrade)
 * SLA: 30-day compensation deadline (from award_declaration stage)
 * Payment states: pending → initiated → completed | failed
 */
import type { PaymentStatus } from './types';

export const LAND_USE_MULTIPLIER: Record<string, number> = {
  agricultural: 1.0,
  residential: 1.4,
  commercial: 1.8,
  industrial: 1.3,
  barren: 0.7,
  forest: 1.2,
};

export const MARKET_MULTIPLIER_DEFAULT = 1.15; // 15% over circle rate (negotiable)
export const COMPENSATION_SLA_DAYS = 30;

export interface CompensationInput {
  circleRatePerSqm: number; // INR per sqm
  areaHectares: number;
  landUse?: string;
  marketMultiplier?: number;
  depreciationFactor?: number; // 0-0.2 e.g. 0.05 = 5% depreciation
  upgradeFactor?: number; // 0-0.3 e.g. improvements
  manualOverride?: number | null;
  manualReason?: string | null;
}

export interface CompensationResult {
  areaSqm: number;
  baseAmount: number;
  landUseMultiplier: number;
  marketMultiplier: number;
  calculatedAmount: number;
  awardedAmount: number;
  manualOverride: boolean;
  breakdown: string;
}

export function calculateCompensation(input: CompensationInput): CompensationResult {
  const areaSqm = Number((input.areaHectares * 10000).toFixed(2)); // ha → sqm
  const landUseMultiplier = LAND_USE_MULTIPLIER[(input.landUse ?? '').toLowerCase()] ?? 1.0;
  const marketMultiplier = input.marketMultiplier ?? MARKET_MULTIPLIER_DEFAULT;
  const depreciation = input.depreciationFactor ?? 0;
  const upgrade = input.upgradeFactor ?? 0;

  const baseAmount = input.circleRatePerSqm * areaSqm;
  const calculated = baseAmount * landUseMultiplier * marketMultiplier * (1 - depreciation + upgrade);
  const calculatedRounded = Math.round(calculated);

  const isOverride = input.manualOverride != null && String(input.manualOverride).trim() !== '';
  const awarded = isOverride ? Math.round(Number(input.manualOverride)) : calculatedRounded;

  const breakdown = `Circle ${input.circleRatePerSqm} × ${areaSqm}sqm = ${baseAmount.toLocaleString('en-IN')} × landUse ${landUseMultiplier} × market ${marketMultiplier} × (1 -${depreciation}+${upgrade}) = ${calculatedRounded.toLocaleString('en-IN')}${isOverride ? ` → Override ${awarded.toLocaleString('en-IN')} (${input.manualReason ?? 'no reason'})` : ''}`;

  return {
    areaSqm,
    baseAmount,
    landUseMultiplier,
    marketMultiplier,
    calculatedAmount: calculatedRounded,
    awardedAmount: awarded,
    manualOverride: isOverride,
    breakdown,
  };
}

export function slaDeadline(fromDate: string | Date, slaDays = COMPENSATION_SLA_DAYS): string {
  const d = new Date(fromDate);
  d.setDate(d.getDate() + slaDays);
  return d.toISOString();
}

export function slaDaysRemaining(deadline: string | null): number | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

export function isSlaBreached(deadline: string | null, paymentStatus: PaymentStatus): boolean {
  if (!deadline || paymentStatus === 'completed') return false;
  return new Date() > new Date(deadline);
}

export function nextPaymentStatus(current: PaymentStatus): PaymentStatus | null {
  if (current === 'pending') return 'initiated';
  if (current === 'initiated') return 'completed';
  return null; // completed/failed are terminal (failed can be retried via initiated)
}
