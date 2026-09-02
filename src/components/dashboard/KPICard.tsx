import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'danger' | 'success';
}

export default function KPICard({ title, value, subtitle, icon: Icon, variant = 'default' }: KPICardProps) {
  const isDanger = variant === 'danger';
  return (
    <Card className={`${isDanger ? 'border-red-200 bg-red-50' : ''}`}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={`text-xs font-medium ${isDanger ? 'text-red-700' : 'text-slate-500'}`}>{title}</div>
            <div className={`text-2xl font-bold mt-1 ${isDanger ? 'text-red-700' : 'text-slate-900'}`}>{value}</div>
            {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
          </div>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isDanger ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
            <Icon size={18} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
