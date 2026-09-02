import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { STAGES } from '../../lib/stages';

interface StagePipelineProps {
  countsByStage: Record<number, number>;
}

const COLORS = ['#0F172A', '#1e293b', '#334155', '#475569', '#64748b', '#0369A1', '#0284c7', '#0ea5e9', '#22c55e', '#16a34a', '#15803d', '#166534'];

export default function StagePipeline({ countsByStage }: StagePipelineProps) {
  const data = STAGES.map((s) => ({
    name: `${s.stage_number}. ${s.stage_name.slice(0, 12)}`,
    count: countsByStage[s.stage_number] ?? 0,
    sla: s.sla_days ?? 0,
  }));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">Stage Pipeline (parcels per stage)</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ left: 40, right: 16, top: 4, bottom: 4 }}>
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v: unknown) => String(v)} />
          <Bar dataKey="count" radius={[0, 6, 6, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
