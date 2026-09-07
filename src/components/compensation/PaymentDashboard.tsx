import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { CompensationAward } from '../../lib/types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { isSlaBreached } from '../../lib/compensation';

interface PaymentDashboardProps {
  awards: CompensationAward[];
  onAdvancePayment?: (award: CompensationAward) => void;
}

export default function PaymentDashboard({ awards, onAdvancePayment }: PaymentDashboardProps) {
  const totalAwarded = awards.reduce((s, a) => s + Number(a.awarded_amount ?? 0), 0);
  const totalPaid = awards.filter((a) => a.payment_status === 'completed').reduce((s, a) => s + Number(a.awarded_amount ?? 0), 0);
  const pending = awards.filter((a) => a.payment_status !== 'completed');
  const breaches = awards.filter((a) => {
    const deadline = a.created_at ? new Date(new Date(a.created_at).getTime() + 30 * 86400000).toISOString() : null;
    return isSlaBreached(deadline, a.payment_status);
  }).length;
  const compliance = awards.length ? Math.round(((awards.length - breaches) / awards.length) * 100) : 100;

  const pieData = [
    { name: 'Paid', value: totalPaid, color: '#22C55E' },
    { name: 'Pending', value: Math.max(0, totalAwarded - totalPaid), color: '#F59E0B' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Total Awarded</div>
          <div className="text-xl font-bold text-slate-900">₹{totalAwarded.toLocaleString('en-IN')}</div>
          <div className="text-xs text-slate-500">{awards.length} awards</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Total Paid</div>
          <div className="text-xl font-bold text-green-700">₹{totalPaid.toLocaleString('en-IN')}</div>
          <div className="text-xs text-slate-500">{compliance}% SLA compliance</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Pending Payments</div>
          <div className="text-xl font-bold text-amber-600">{pending.length}</div>
          <div className="text-xs text-red-600">{breaches} breached (30d SLA)</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Paid vs Pending</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                {pieData.map((e) => (
                  <Cell key={e.name} fill={e.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: unknown) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          {/* SLA gauge (simple bar) */}
          <div className="mt-2">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>SLA Compliance</span>
              <span>{compliance}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full ${compliance >= 80 ? 'bg-green-600' : compliance >= 60 ? 'bg-amber-500' : 'bg-red-600'}`} style={{ width: `${compliance}%` }} />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Payment History</h3>
          <div className="overflow-auto max-h-[240px] border border-slate-100 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Parcel</th>
                  <th className="px-3 py-2 text-right font-medium">Awarded</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  {onAdvancePayment && <th className="px-3 py-2 text-left font-medium">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {awards.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                      No awards
                    </td>
                  </tr>
                ) : (
                  awards.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-slate-700">{a.parcel_id.slice(0, 8)}</td>
                      <td className="px-3 py-2 text-right">₹{Number(a.awarded_amount).toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2">
                        <Badge variant={a.payment_status === 'completed' ? 'success' : a.payment_status === 'failed' ? 'danger' : a.payment_status === 'initiated' ? 'info' : 'warning'}>
                          {a.payment_status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-slate-500">{a.payment_date ? new Date(a.payment_date).toLocaleDateString() : '-'}</td>
                      {onAdvancePayment && (
                        <td className="px-3 py-2">
                          {a.payment_status === 'pending' || a.payment_status === 'initiated' ? (
                            <Button size="sm" variant="secondary" onClick={() => onAdvancePayment(a)}>
                              {a.payment_status === 'pending' ? 'Initiate' : 'Mark Paid'}
                            </Button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
