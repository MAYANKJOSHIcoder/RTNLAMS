import { Clock, FileText, Map, Gavel, Wallet, ShieldCheck } from 'lucide-react';

export interface ActivityItem {
  id: string;
  type: string;
  description: string;
  created_at: string;
  parcel_id?: string;
}

const ICONS: Record<string, typeof FileText> = {
  document: FileText,
  parcel: Map,
  hearing: Gavel,
  compensation: Wallet,
  audit: ShieldCheck,
  stage: Clock,
};

export default function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (!items.length) return <div className="bg-[#0c0c0c] border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-500">No recent activity</div>;
  return (
    <div className="bg-[#0c0c0c] border border-slate-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
        <Clock size={14} /> Recent Activity
      </h3>
      <div className="space-y-3 max-h-[320px] overflow-auto">
        {items.map((it) => {
          const Icon = ICONS[it.type] ?? Clock;
          return (
            <div key={it.id} className="flex gap-3">
              <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                <Icon size={12} className="text-slate-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-slate-900 truncate">{it.description}</div>
                <div className="text-xs text-slate-500">{new Date(it.created_at).toLocaleString()} {it.parcel_id ? `• ${it.parcel_id.slice(0, 8)}` : ''}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
