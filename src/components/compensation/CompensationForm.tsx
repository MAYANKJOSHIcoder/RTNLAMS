import { useState, useMemo } from 'react';
import { Calculator, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { calculateCompensation, LAND_USE_MULTIPLIER, nextPaymentStatus, slaDaysRemaining } from '../../lib/compensation';
import type { CompensationAward } from '../../lib/types';

interface CompensationFormProps {
  award?: CompensationAward | null;
  parcel?: { area_hectares: number; land_use?: string | null };
  onSave: (payload: { calculated_amount: number; awarded_amount: number; payment_status: string; multiplier: Record<string, unknown>; circle_rate_per_sqm: number; area_sqm: number }) => void;
  saving?: boolean;
}

export default function CompensationForm({ award, parcel, onSave, saving }: CompensationFormProps) {
  const [circleRate, setCircleRate] = useState(String(award?.circle_rate_per_sqm ?? 3500));
  const [marketMult, setMarketMult] = useState(String((award?.multiplier as Record<string, unknown>)?.marketMultiplier ?? 1.15));
  const [landUse, setLandUse] = useState(String(parcel?.land_use ?? 'agricultural'));
  const [manual, setManual] = useState(String(award?.awarded_amount ?? ''));
  const [reason, setReason] = useState('');
  const [useManual, setUseManual] = useState(false);

  const calc = useMemo(() => {
    const r = Number(circleRate);
    const m = Number(marketMult);
    if (!Number.isFinite(r) || r <= 0) return null;
    return calculateCompensation({
      circleRatePerSqm: r,
      areaHectares: parcel?.area_hectares ?? Number(award?.area_sqm ? award.area_sqm / 10000 : 1),
      landUse,
      marketMultiplier: Number.isFinite(m) ? m : 1.15,
      manualOverride: useManual ? Number(manual) : null,
      manualReason: reason || null,
    });
  }, [circleRate, marketMult, landUse, parcel?.area_hectares, award?.area_sqm, useManual, manual, reason]);

  const slaLeft = award?.created_at ? slaDaysRemaining(new Date(new Date(award.created_at).getTime() + 30 * 86400000).toISOString()) : null;
  const nextStatus = award ? nextPaymentStatus(award.payment_status) : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Calculator size={18} className="text-slate-600" />
        <h3 className="text-sm font-semibold text-slate-900">Compensation Calculator</h3>
        {slaLeft != null && slaLeft < 7 && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-full">
            <AlertTriangle size={12} /> {slaLeft}d left (30d SLA)
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Input label="Circle rate (₹/sqm)" value={circleRate} onChange={(e) => setCircleRate(e.target.value)} requiredIndicator />
        <Input label="Market multiplier" value={marketMult} onChange={(e) => setMarketMult(e.target.value)} />
        <Select
          label="Land use"
          options={Object.keys(LAND_USE_MULTIPLIER).map((k) => ({ value: k, label: `${k} (×${LAND_USE_MULTIPLIER[k]})` }))}
          value={landUse}
          onChange={(e) => setLandUse(e.target.value)}
        />
      </div>

      {calc && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 space-y-1">
          <div>Area: {calc.areaSqm.toLocaleString('en-IN')} sqm • Base: ₹{calc.baseAmount.toLocaleString('en-IN')}</div>
          <div>Multipliers: landUse ×{calc.landUseMultiplier} • market ×{calc.marketMultiplier}</div>
          <div className="font-semibold">Calculated: ₹{calc.calculatedAmount.toLocaleString('en-IN')}</div>
          <div className="text-[11px] text-slate-500">{calc.breakdown}</div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input type="checkbox" id="useManual" checked={useManual} onChange={(e) => setUseManual(e.target.checked)} className="rounded" />
        <label htmlFor="useManual" className="text-sm text-slate-700">Manual override with reason</label>
      </div>
      {useManual && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Award amount (₹)" value={manual} onChange={(e) => setManual(e.target.value)} />
          <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Court order / negotiation" />
        </div>
      )}

      {award && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Payment:</span>
          <span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded-full font-medium">{award.payment_status}</span>
          {nextStatus && <span className="text-slate-400">→ next: {nextStatus}</span>}
        </div>
      )}

      <Button
        onClick={() => {
          if (!calc) return;
          const awarded = useManual && manual ? Math.round(Number(manual)) : calc.awardedAmount;
          onSave({
            calculated_amount: calc.calculatedAmount,
            awarded_amount: awarded,
            payment_status: award?.payment_status ?? 'pending',
            multiplier: { landUse, marketMultiplier: Number(marketMult), manualOverride: useManual ? awarded : null, manualReason: reason || null },
            circle_rate_per_sqm: Number(circleRate),
            area_sqm: calc.areaSqm,
          });
        }}
        disabled={!calc}
        loading={saving}
        className="w-full"
      >
        {award ? 'Update Award' : 'Create Award'}
      </Button>
    </div>
  );
}
