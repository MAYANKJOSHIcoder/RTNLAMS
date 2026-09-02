import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import type { RiskAssessment, Parcel, RiskLevel } from '../../lib/types';
import { Badge } from '../ui/Badge';

const COLORS: Record<RiskLevel, string> = {
  low: '#22C55E',
  medium: '#EAB308',
  high: '#F97316',
  critical: '#EF4444',
};

interface RiskWidgetProps {
  assessments: RiskAssessment[];
  parcels: Parcel[]; // to map parcel_id → display name
  trend?: { date: string; avgRisk: number }[]; // risk over time
}

export default function RiskWidget({ assessments, parcels, trend }: RiskWidgetProps) {
  const byLevel = (['critical', 'high', 'medium', 'low'] as RiskLevel[]).map((level) => ({
    name: level,
    value: assessments.filter((a) => a.risk_level === level).length,
    color: COLORS[level],
  }));

  const top10 = [...assessments]
    .sort((a, b) => b.overall_risk - a.overall_risk)
    .slice(0, 10)
    .map((a) => {
      const p = parcels.find((pp) => pp.id === a.parcel_id);
      return { ...a, parcel_number: p?.parcel_number ?? a.parcel_id.slice(0, 8), owner: p?.owner_name ?? '-' };
    });

  const mockTrend =
    trend ??
    Array.from({ length: 7 }, (_, i) => ({
      date: `Day ${i + 1}`,
      avgRisk: Number((0.35 + Math.random() * 0.25).toFixed(2)),
    }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Donut: distribution */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Risk Distribution</h3>
          {assessments.length === 0 ? (
            <div className="text-xs text-slate-500 py-8 text-center">No assessments yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={byLevel} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  {byLevel.map((e) => (
                    <Cell key={e.name} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {byLevel.map((l) => (
              <span key={l.name} className="inline-flex items-center gap-1 text-xs">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} /> {l.name}: {l.value}
              </span>
            ))}
          </div>
        </div>

        {/* Top 10 table */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Top 10 High-Risk Parcels</h3>
          <div className="overflow-auto max-h-[220px] border border-slate-100 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Parcel</th>
                  <th className="px-3 py-2 text-left font-medium">Owner</th>
                  <th className="px-3 py-2 text-right font-medium">Risk</th>
                  <th className="px-3 py-2 text-left font-medium">Level</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {top10.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                      No data
                    </td>
                  </tr>
                ) : (
                  top10.map((r) => (
                    <tr key={r.parcel_id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-900">{r.parcel_number}</td>
                      <td className="px-3 py-2 text-slate-600">{r.owner}</td>
                      <td className="px-3 py-2 text-right">{r.overall_risk.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <Badge variant={r.risk_level === 'critical' ? 'danger' : r.risk_level === 'high' ? 'danger' : r.risk_level === 'medium' ? 'warning' : 'success'}>
                          {r.risk_level}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Trend line */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-2">Risk Trend (7 days)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={mockTrend}>
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 1]} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="avgRisk" stroke="#0F172A" strokeWidth={2} dot={false} name="Avg risk" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
