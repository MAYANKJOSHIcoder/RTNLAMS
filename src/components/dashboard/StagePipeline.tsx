import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { STAGES } from '../../lib/stages';

interface StagePipelineProps {
  countsByStage: Record<number, number>;
}

  const COLORS = ['#ffffff', '#e5e5e5', '#cccccc', '#a6a6a6', '#8f8f8f', '#7d7d7d', '#38bdf8', '#7dd3fc', '#0ea5e9', '#00d294', '#16a34a', '#15803d'];

export default function StagePipeline({ countsByStage }: StagePipelineProps) {
  const data = STAGES.map((s) => ({
    name: `${s.stage_number}. ${s.stage_name.slice(0, 12)}`,
    count: countsByStage[s.stage_number] ?? 0,
    sla: s.sla_days ?? 0,
  }));

  return (
    <div className="bg-[#0c0c0c] border border-slate-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">Stage Pipeline (parcels per stage)</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ left: 40, right: 16, top: 4, bottom: 4 }}>
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#8f8f8f' }} stroke="#ffffff1a" />
          <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: '#8f8f8f' }} stroke="#ffffff1a" />
          <Tooltip formatter={(v: unknown) => String(v)} contentStyle={{ background: '#0c0c0c', border: '1px solid #ffffff1a', borderRadius: 8, color: '#ededed' }} cursor={{ fill: '#ffffff09' }} />
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
