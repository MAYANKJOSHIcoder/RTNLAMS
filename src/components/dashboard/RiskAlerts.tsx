import { AlertTriangle } from 'lucide-react';
import { Badge } from '../ui/Badge';
import type { RiskAssessment, Parcel } from '../../lib/types';

interface RiskAlertsProps {
  assessments: RiskAssessment[];
  parcels: Parcel[];
}

export default function RiskAlerts({ assessments, parcels }: RiskAlertsProps) {
  const top = [...assessments]
    .filter((a) => a.risk_level === 'critical' || a.risk_level === 'high')
    .sort((a, b) => b.overall_risk - a.overall_risk)
    .slice(0, 5);
  if (!top.length) return <div className="bg-[#0c0c0c] border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-500">No high-risk alerts</div>;
  return (
    <div className="bg-[#0c0c0c] border border-slate-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
        <AlertTriangle size={14} className="text-red-600" /> Risk Alerts (Top 5)
      </h3>
      <div className="space-y-2">
        {top.map((a) => {
          const p = parcels.find((pp) => pp.id === a.parcel_id);
          return (
            <div key={a.parcel_id} className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg hover:bg-white/[0.04]">
              <span className={`w-2 h-8 rounded-full ${a.risk_level === 'critical' ? 'bg-red-600' : 'bg-orange-500'}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-slate-900 truncate">{p?.parcel_number ?? a.parcel_id.slice(0, 8)} — {p?.owner_name ?? '-'}</div>
                <div className="text-xs text-slate-500">Risk {a.overall_risk.toFixed(2)} • {p?.status ?? '-'}</div>
              </div>
              <Badge variant={a.risk_level === 'critical' ? 'danger' : 'warning'}>{a.risk_level}</Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
