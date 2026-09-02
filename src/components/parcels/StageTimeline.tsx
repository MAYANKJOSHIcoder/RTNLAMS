import { Check, AlertTriangle, Clock, Eye } from 'lucide-react';
import { STAGES, isBreached as checkBreached } from '../../lib/stages';
import type { AcquisitionStage } from '../../lib/types';
import { cn } from '../../lib/utils/helpers';

interface StageTimelineProps {
  stages: AcquisitionStage[];
  onStageClick?: (stage: AcquisitionStage | undefined, def: (typeof STAGES)[number]) => void;
}

export default function StageTimeline({ stages, onStageClick }: StageTimelineProps) {
  const byNumber = new Map(stages.map((s) => [s.stage_number, s]));
  // current = first in_progress, else last completed +1, else 1
  const current = stages.find((s) => s.status === 'in_progress')?.stage_number ??
    (stages.filter((s) => s.status === 'completed').length + 1);

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-start gap-1 min-w-[800px] py-2">
        {STAGES.map((def) => {
          const st = byNumber.get(def.stage_number);
          const status = st?.status ?? 'pending';
          const breached = st ? checkBreached(st) : false;
          const isCompleted = status === 'completed';
          const isCurrent = def.stage_number === current;
          const breachedFlag = breached || status === 'breached';

          return (
            <button
              key={def.stage_number}
              onClick={() => onStageClick?.(st, def)}
              className={cn(
                'flex-1 min-w-0 flex flex-col items-center gap-1.5 p-2 rounded-lg border text-left cursor-pointer transition-colors',
                isCompleted && 'bg-green-50 border-green-200 hover:bg-green-100',
                breachedFlag && 'bg-red-50 border-red-200 hover:bg-red-100',
                isCurrent && !isCompleted && !breachedFlag && 'bg-blue-50 border-blue-300 ring-1 ring-blue-200',
                status === 'pending' && !isCurrent && 'bg-white border-slate-200 hover:bg-slate-50',
              )}
              aria-label={`${def.stage_name} — ${status}`}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border',
                  isCompleted && 'bg-green-600 text-white border-green-600',
                  breachedFlag && 'bg-red-600 text-white border-red-600',
                  isCurrent && !isCompleted && !breachedFlag && 'bg-[#0F172A] text-white border-[#0F172A]',
                  status === 'pending' && !isCurrent && 'bg-white text-slate-500 border-slate-300',
                )}
              >
                {isCompleted ? <Check size={14} /> : breachedFlag ? <AlertTriangle size={14} /> : def.stage_number}
              </div>
              <div className="text-[11px] font-medium text-slate-900 text-center leading-tight line-clamp-2">{def.stage_name}</div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                {isCompleted ? (
                  <><Check size={10} /> Done</>
                ) : breachedFlag ? (
                  <><AlertTriangle size={10} className="text-red-600" /> Breached</>
                ) : st?.sla_deadline ? (
                  <><Clock size={10} /> {new Date(st.sla_deadline!).toLocaleDateString()}</>
                ) : def.sla_days ? (
                  <><Clock size={10} /> {def.sla_days}d SLA</>
                ) : (
                  <><Eye size={10} /> Open</>
                )}
              </div>
              <div className={cn('text-[10px] px-1.5 py-0.5 rounded-full border capitalize', isCompleted ? 'bg-green-100 border-green-200 text-green-700' : breachedFlag ? 'bg-red-100 border-red-200 text-red-700' : isCurrent ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-slate-100 border-slate-200 text-slate-600')}>
                {status.replace('_', ' ')}
              </div>
            </button>
          );
        })}
      </div>
      {/* Progress bar */}
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
        <div
          className="h-full bg-[#0F172A] transition-all"
          style={{ width: `${(stages.filter((s) => s.status === 'completed').length / STAGES.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
