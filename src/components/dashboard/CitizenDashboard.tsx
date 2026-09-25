import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, AlertTriangle, Clock, HelpCircle } from 'lucide-react';
import { useParcels } from '../../hooks/useParcels';
import { useStages } from '../../hooks/useStages';
import { useCompensation } from '../../hooks/useCompensation';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { formatArea } from '../../lib/units';
import type { AreaUnit } from '../../lib/units';
import { STAGES } from '../../lib/stages';
import type { Parcel } from '../../lib/types';
import RaiseQueryModal from '../queries/RaiseQueryModal';


/**
 * Citizen roadmap — own parcels (RLS-scoped by aadhaar) with the 12-stage
 * stepper, current stage, next SLA date, and payment status. Read-only.
 */
export default function CitizenDashboard() {
  const { data: parcels = [], isLoading } = useParcels(null, undefined);

  if (isLoading) return <div className="py-12 text-center text-sm text-slate-500">Loading your parcels…</div>;

  if (parcels.length === 0) {
    return (
      <div className="bg-[#0c0c0c] border border-slate-200 rounded-xl p-8 text-center">
        <MapPin size={28} className="mx-auto text-slate-500 mb-3" />
        <h2 className="text-lg font-semibold text-slate-900">No parcels linked to your account yet</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
          Parcels appear here once the acquiring authority records your 12-digit Aadhaar as the owner.
          If your land is affected and nothing shows, contact your field officer.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Your Land — Acquisition Roadmap</h1>
        <p className="text-sm text-slate-500 mt-1">{parcels.length} parcel{parcels.length === 1 ? '' : 's'} linked to your Aadhaar. Click a parcel for full details.</p>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {parcels.map((p) => (
          <CitizenParcelCard key={p.id} parcel={p} />
        ))}
      </div>
    </div>
  );
}

function CitizenParcelCard({ parcel }: { parcel: Parcel }) {
  const [queryModalOpen, setQueryModalOpen] = useState(false);
  const { data: stages = [] } = useStages(parcel.id);
  const { data: awards = [] } = useCompensation(parcel.id);
  const award = awards[0];

  const { current, completedCount, nextDeadline, breached } = useMemo(() => {
    const inProgress = stages.find((s) => s.status === 'in_progress');
    const br = stages.find((s) => s.status === 'breached');
    const completed = stages.filter((s) => s.status === 'completed').length;
    return {
      current: inProgress ?? br,
      completedCount: completed,
      nextDeadline: inProgress?.sla_deadline ?? br?.sla_deadline ?? null,
      breached: br,
    };
  }, [stages]);

  const currentDef = current ? STAGES.find((s) => s.stage_number === current.stage_number) : undefined;

  return (
    <div className="bg-[#0c0c0c] border border-slate-200 rounded-xl p-4 transition-colors">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <Link to={`/parcels?parcel=${parcel.id}`} className="flex items-center gap-2 flex-wrap group">
          <span className="font-semibold text-slate-900 group-hover:text-sky-400 transition-colors">{parcel.parcel_number}</span>
          <Badge variant={parcel.status === 'disputed' ? 'danger' : 'neutral'}>{parcel.status}</Badge>
          <span className="text-xs text-slate-500">{formatArea(parcel.area_hectares, 'hectare' as AreaUnit)}{parcel.village ? ` · ${parcel.village}` : ''}</span>
        </Link>
        <div className="flex items-center gap-2">
          {award && (
            <Badge variant={award.payment_status === 'completed' ? 'success' : 'warning'}>
              Payment: {award.payment_status === 'completed' ? '₹ paid' : '₹' + Number(award.awarded_amount).toLocaleString('en-IN') + ' ' + award.payment_status}
            </Badge>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setQueryModalOpen(true)}
            className="text-xs h-7 gap-1 cursor-pointer"
          >
            <HelpCircle size={13} />
            Raise Query
          </Button>
        </div>
      </div>

      {/* 12-stage stepper roadmap */}
      <Link to={`/parcels?parcel=${parcel.id}`} className="block">
        <div className="flex items-center gap-0.5 mt-3" aria-label="Acquisition progress">
          {STAGES.map((def, i) => {
            const st = stages.find((s) => s.stage_number === def.stage_number);
            const status = st?.status ?? 'pending';
            return (
              <div key={def.stage_number} className="flex-1 flex flex-col items-center gap-1" title={`${def.stage_number}. ${def.stage_name} — ${status}`}>
                <div
                  className={`h-1.5 w-full rounded-full ${
                    status === 'completed' ? 'bg-green-500'
                    : status === 'in_progress' ? 'bg-white'
                    : status === 'breached' ? 'bg-red-500'
                    : 'bg-white/10'
                  }`}
                />
                {i === 0 || i === 11 || st?.status === 'in_progress' ? (
                  <span className={`text-[9px] ${st?.status === 'in_progress' ? 'text-white font-semibold' : 'text-slate-500'}`}>
                    {def.stage_number}
                  </span>
                ) : (
                  <span className="text-[9px] text-transparent">·</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
          {breached ? (
            <span className="flex items-center gap-1 text-red-400"><AlertTriangle size={12} /> Stage {breached.stage_number} SLA breached — authority notified</span>
          ) : currentDef ? (
            <span>Current: <span className="text-slate-300 font-medium">{currentDef.stage_number}. {currentDef.stage_name}</span></span>
          ) : (
            <span>Completed — all 12 stages done</span>
          )}
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {completedCount}/12 stages
            {nextDeadline && !breached ? ` · next ${new Date(nextDeadline).toLocaleDateString()}` : ''}
          </span>
        </div>
      </Link>

      <RaiseQueryModal
        open={queryModalOpen}
        onClose={() => setQueryModalOpen(false)}
        parcelId={parcel.id}
        parcelNumber={parcel.parcel_number}
      />
    </div>
  );
}
