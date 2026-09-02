import { useState } from 'react';
import { STAGES, canAdvance } from '../../lib/stages';
import type { AcquisitionStage, Parcel } from '../../lib/types';
import { Badge, statusToBadgeVariant } from '../ui/Badge';

interface StageBoardProps {
  stagesByParcel: Map<string, AcquisitionStage[]>;
  parcels: Parcel[];
  onMoveParcel: (parcelId: string, targetStageNumber: number) => void;
}

export default function StageBoard({ stagesByParcel, parcels, onMoveParcel }: StageBoardProps) {
  const [dragParcel, setDragParcel] = useState<string | null>(null);

  // Map parcel → current stage number (first in_progress or last completed+1)
  const currentStage = (parcelId: string): number => {
    const stages = stagesByParcel.get(parcelId) ?? [];
    const inProg = stages.find((s) => s.status === 'in_progress')?.stage_number;
    if (inProg) return inProg;
    const completed = stages.filter((s) => s.status === 'completed').length;
    return completed + 1;
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {STAGES.map((def) => {
        const columnParcels = parcels.filter((p) => currentStage(p.id) === def.stage_number);
        return (
          <div
            key={def.stage_number}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragParcel) {
                const stages = stagesByParcel.get(dragParcel) ?? [];
                const check = canAdvance(stages, def.stage_number);
                if (!check.ok) {
                  alert(check.reason);
                } else {
                  onMoveParcel(dragParcel, def.stage_number);
                }
                setDragParcel(null);
              }
            }}
            className="min-w-56 w-56 bg-slate-50 border border-slate-200 rounded-lg flex flex-col shrink-0"
          >
            <div className="px-3 py-2 border-b border-slate-200 bg-white rounded-t-lg sticky top-0">
              <div className="text-xs font-semibold text-slate-900 truncate">{def.stage_number}. {def.stage_name}</div>
              <div className="text-xs text-slate-500">{columnParcels.length} parcels {def.sla_days ? `• ${def.sla_days}d` : ''}</div>
            </div>
            <div className="flex-1 p-2 space-y-2 overflow-auto max-h-[400px]">
              {columnParcels.length === 0 && <div className="text-xs text-slate-400 text-center py-6">No parcels</div>}
              {columnParcels.map((p) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={() => setDragParcel(p.id)}
                  onDragEnd={() => setDragParcel(null)}
                  className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm cursor-move hover:shadow-md transition-shadow"
                >
                  <div className="text-xs font-medium text-slate-900 truncate">{p.parcel_number}</div>
                  <div className="text-xs text-slate-500 truncate">{p.owner_name}</div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Badge variant={statusToBadgeVariant(p.status)}>{p.status}</Badge>
                    {p.risk_score != null && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${p.risk_score > 0.6 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                        risk {p.risk_score}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
