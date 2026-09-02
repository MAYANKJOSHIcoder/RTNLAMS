import { cn } from '../../lib/utils/helpers';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'default';

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  danger: 'bg-red-100 text-red-800 border-red-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  default: 'bg-slate-100 text-slate-700 border-slate-200',
};

export interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
}

export function Badge({ variant = 'default', className, children }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border', variantClasses[variant], className)}>
      {children}
    </span>
  );
}

// Helper to map domain statuses → badge variant (per PROMPT 8 spec)
export function statusToBadgeVariant(status: string): BadgeVariant {
  const s = status.toLowerCase();
  if (['acquired', 'completed', 'verified', 'success', 'low'].includes(s)) return 'success';
  if (['surveyed', 'in_progress', 'processing', 'warning', 'medium'].includes(s)) return 'warning';
  if (['disputed', 'breached', 'flagged', 'failed', 'critical', 'high', 'danger'].includes(s)) return 'danger';
  if (['notified', 'identified', 'pending', 'uploaded', 'info'].includes(s)) return 'info';
  return 'neutral';
}

export default Badge;
