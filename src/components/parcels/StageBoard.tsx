import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';
import { useParcels } from '../../hooks/useParcels';
import { useAllStages, useAdvanceStage } from '../../hooks/useStages';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../lib/permissions';
import { STAGES, canAdvance, dropTargets } from '../../lib/stages';
import { Badge } from '../ui/Badge';
import ResolveBreachModal from './ResolveBreachModal';
import type { Parcel, AcquisitionStage } from '../../lib/types';

function riskBadgeClass(score?: number | null): string {
  const v = score ?? 0;
  if (v > 0.8) return 'bg-red-50 border-red-200 text-red-700';
  if (v > 0.6) return 'bg-orange-50 border-orange-200 text-orange-700';
  if (v > 0.3) return 'bg-yellow-50 border-yellow-200 text-yellow-700';
  return 'bg-green-50 border-green-200 text-green-700';
}

interface StageBoardProps {
  projectId?: string;
}

export default function StageBoard({ projectId }: StageBoardProps) {
  const { data: parcels = [], isLoading } = useParcels(null, projectId ?? undefined);
  const advance = useAdvanceStage();
  const { profile } = useAuth();
  const [dragParcelId, setDragParcelId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [resolveStage, setResolveStage] = useState<AcquisitionStage | null>(null);

  // Fail-closed: only known staff roles can drag; null/unknown profile = read-only
  const editable = can(profile?.role ?? null, 'stage.advance');

  const { data: allStages = [], isLoading: stagesLoading } = useAllStages();

  const stagesByParcel = useMemo(() => {
    const map = new Map<string, AcquisitionStage[]>();
    allStages.forEach((s) => {
      const list = map.get(s.parcel_id) ?? [];
      list.push(s);
      map.set(s.parcel_id, list);
    });
    return map;
  }, [allStages]);

  const currentStageNumber = (stages: AcquisitionStage[]): number => {
    const inProgress = stages.find((s) => s.status === 'in_progress');
    if (inProgress) return inProgress.stage_number;
    const breached = stages.find((s) => s.status === 'breached');
    if (breached) return breached.stage_number;
    const lastCompleted = stages.filter((s) => s.status === 'completed').reduce((max, s) => Math.max(max, s.stage_number), 0);
    return Math.min(12, lastCompleted + 1);
  };

  const columns = useMemo(() => {
    const cols: { stageNumber: number; parcels: Parcel[] }[] = STAGES.map((def) => ({ stageNumber: def.stage_number, parcels: [] }));
    parcels.forEach((p) => {
      const n = currentStageNumber(stagesByParcel.get(p.id) ?? []);
      const col = cols.find((c) => c.stageNumber === n);
      if (col) col.parcels.push(p);
    });
    return cols;
  }, [parcels, stagesByParcel]);

  // While dragging: allowed drop targets for the dragged parcel
  const draggedTargets = useMemo(() => {
    if (!dragParcelId) return null;
    return dropTargets(stagesByParcel.get(dragParcelId) ?? []);
  }, [dragParcelId, stagesByParcel]);

  const handleDrop = (stageNumber: number) => {
    setDropTarget(null);
    const parcelId = dragParcelId;
    setDragParcelId(null);
    if (!parcelId || !editable) return;
    const stages = stagesByParcel.get(parcelId) ?? [];
    const check = canAdvance(stages, stageNumber);
    if (check.noop) return; // drop on own column — nothing to do
    if (!check.ok) {
      toast.error(check.reason ?? 'Cannot advance');
      return;
    }
    const inProgress = stages.find((s) => s.status === 'in_progress');
    if (!inProgress) {
      toast.error('No in-progress stage row for this parcel');
      return;
    }
    advance.mutate({ stageId: inProgress.id, parcelId });
  };

  if (isLoading || stagesLoading) {
    return <div className="py-12 text-center text-sm text-slate-500">Loading board…</div>;
  }

  return (
    <div className="space-y-2">
      {!editable && (
        <p className="text-xs text-slate-500">Read-only — only admins and field officers can advance stages.</p>
      )}
      {editable && (
        <p className="text-xs text-slate-500">Drag a card to the <span className="text-green-400 font-medium">next</span> column to advance. Red columns need earlier stages completed first.</p>
      )}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-2 min-w-max">
          {columns.map((col) => {
            const def = STAGES.find((s) => s.stage_number === col.stageNumber);
            const dragging = dragParcelId != null;
            const isAllowed = dragging && draggedTargets != null && (col.stageNumber === draggedTargets.current || col.stageNumber === draggedTargets.next);
            const isBlocked = dragging && draggedTargets != null && col.stageNumber !== draggedTargets.current && col.stageNumber !== draggedTargets.next;
            const isTarget = dropTarget === col.stageNumber && dragging;
            return (
              <div
                key={col.stageNumber}
                onDragOver={(e) => {
                  if (!editable || !dragParcelId) return;
                  e.preventDefault();
                  setDropTarget(col.stageNumber);
                }}
                onDragLeave={() => setDropTarget((t) => (t === col.stageNumber ? null : t))}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(col.stageNumber);
                }}
                className={`w-52 shrink-0 rounded-lg border p-2 transition-colors ${
                  isTarget && isAllowed
                    ? 'border-green-400 bg-green-500/10 border-dashed'
                    : isTarget && isBlocked
                      ? 'border-red-400 bg-red-500/10 border-dashed'
                      : isAllowed && dragging
                        ? 'border-green-400/40'
                        : 'border-slate-200 bg-slate-50/[0.03]'
                } ${editable ? '' : 'opacity-90'}`}
              >
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-semibold text-slate-700 leading-tight">
                    {col.stageNumber}. {def?.stage_name}
                  </span>
                  <span className="text-[10px] text-slate-400 bg-[#0c0c0c] border border-slate-200 rounded px-1">{col.parcels.length}</span>
                </div>
                <div className="space-y-1.5 min-h-16">
                  {col.parcels.map((p) => {
                    const stages = stagesByParcel.get(p.id) ?? [];
                    const breached = stages.find((s) => s.status === 'breached');
                    return (
                      <div
                        key={p.id}
                        draggable={editable}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', p.id);
                          setDragParcelId(p.id);
                        }}
                        onDragEnd={() => {
                          setDragParcelId(null);
                          setDropTarget(null);
                        }}
                        className={`bg-[#0c0c0c] border rounded-md p-2 shadow-sm ${
                          breached ? 'border-red-400/60' : 'border-slate-200'
                        } ${editable ? 'cursor-grab active:cursor-grabbing hover:border-[#38bdf8]' : 'cursor-default'}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-medium text-slate-900 truncate">{p.parcel_number}</span>
                          <span className={`px-1 py-0.5 rounded text-[10px] border ${riskBadgeClass(p.risk_score)}`}>
                            {p.risk_score != null ? p.risk_score.toFixed(2) : '-'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">{p.owner_name}</div>
                        <div className="mt-1 flex items-center gap-1 flex-wrap">
                          <Badge variant={p.status === 'disputed' ? 'danger' : 'neutral'} className="text-[10px]">
                            {p.status}
                          </Badge>
                          {breached && (
                            <Badge variant="danger" className="text-[10px]">
                              <AlertTriangle size={9} className="mr-0.5 inline" />
                              {breached.stage_number} breached
                            </Badge>
                          )}
                        </div>
                        {breached && can(profile?.role ?? null, 'stage.resolveBreach') && (
                          <button
                            onClick={() => setResolveStage(breached)}
                            className="mt-1.5 w-full text-[10px] font-medium text-red-400 border border-red-400/40 rounded px-1.5 py-1 hover:bg-red-500/10 cursor-pointer transition-colors"
                          >
                            Resolve breach
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {col.parcels.length === 0 && <div className="text-[10px] text-slate-300 text-center py-3">Empty</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <ResolveBreachModal stage={resolveStage} onClose={() => setResolveStage(null)} />
    </div>
  );
}
