import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Gavel, CalendarDays } from 'lucide-react';
import { useHearings } from '../hooks/useHearings';
import { useParcels } from '../hooks/useParcels';
import HearingForm from '../components/hearings/HearingForm';
import HearingCalendar from '../components/hearings/HearingCalendar';
import ParcelSelect from '../components/common/ParcelSelect';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { can } from '../lib/permissions';
import type { Hearing, Parcel } from '../lib/types';

export default function Hearings() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [parcelId, setParcelId] = useState(routeId ?? '');
  const [selectedHearing, setSelectedHearing] = useState<Hearing | null>(null);

  useEffect(() => {
    if (routeId) setParcelId(routeId);
  }, [routeId]);

  const { data: hearings = [], isLoading, isError, error } = useHearings(parcelId || undefined);
  const allHearingsQuery = useHearings(undefined);
  const allHearings = allHearingsQuery.data ?? [];
  const { data: parcelsData = [] } = useParcels(null, undefined);
  const parcels = parcelsData as Parcel[];

  const parcelName = (id: string) => {
    const p = parcels.find((x) => x.id === id);
    return p ? `${p.parcel_number} — ${p.owner_name}` : id.slice(0, 8);
  };

  const handleSelect = (id: string) => {
    setParcelId(id);
    setSelectedHearing(null);
    navigate(id ? `/hearings/${id}` : '/hearings', { replace: true });
  };

  const list = parcelId ? hearings : allHearings;

  return (
    <div className="p-6 space-y-4">
      {isError && <ErrorBanner message={`Hearings failed to load: ${error?.message ?? 'check connection / RLS'}`} />}
      <h1 className="text-2xl font-semibold text-slate-900">Hearings</h1>

      <ParcelSelect value={parcelId} onChange={handleSelect} />

      {parcelId && can(profile?.role, 'hearing.schedule') && (
        <HearingForm parcelId={parcelId} />
      )}

      {/* Hearing list */}
      <div className="space-y-2">
        {(parcelId ? isLoading : allHearingsQuery.isLoading) ? (
          <div className="py-8 text-center text-sm text-slate-500">Loading…</div>
        ) : list.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            {parcelId ? 'No hearings for this parcel yet.' : 'No hearings found.'}
          </div>
        ) : (
          list.map((h) => (
            <button
              key={h.id}
              onClick={() => setSelectedHearing(h)}
              className={`w-full text-left border rounded-lg p-3 text-sm transition-colors cursor-pointer ${
                selectedHearing?.id === h.id ? 'border-[#38bdf8] bg-[#38bdf8]/5' : 'border-slate-200 hover:border-slate-400'
              }`}
            >
              <div className="flex justify-between items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 font-medium">
                  <Gavel size={14} className="text-slate-500" /> {h.type}
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                  <CalendarDays size={12} /> {new Date(h.hearing_date).toLocaleString()}
                </span>
              </div>
              <div className="text-slate-600 mt-1 truncate">{h.outcome ?? h.notes ?? 'No details recorded'}</div>
            </button>
          ))
        )}
      </div>

      {/* Full hearing detail */}
      {selectedHearing && (
        <div className="bg-[#0c0c0c] border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <Gavel size={14} /> Hearing Details
            </h2>
            <button onClick={() => setSelectedHearing(null)} className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer">Close</button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-slate-500">Type:</span> <Badge variant="info">{selectedHearing.type}</Badge></div>
            <div><span className="text-slate-500">Date:</span> <span className="font-medium">{new Date(selectedHearing.hearing_date).toLocaleString()}</span></div>
            <div className="col-span-2"><span className="text-slate-500">Parcel:</span> <span className="font-medium">{parcelName(selectedHearing.parcel_id)}</span></div>
            {selectedHearing.outcome && <div className="col-span-2"><span className="text-slate-500">Outcome:</span> <span className="font-medium">{selectedHearing.outcome}</span></div>}
            {selectedHearing.notes && <div className="col-span-2"><span className="text-slate-500">Notes:</span> {selectedHearing.notes}</div>}
            {selectedHearing.attendees && Array.isArray(selectedHearing.attendees) && selectedHearing.attendees.length > 0 && (
              <div className="col-span-2">
                <span className="text-slate-500">Attendees:</span>{' '}
                {(selectedHearing.attendees as unknown[]).map((a, i) => (
                  <span key={i} className="inline-block bg-slate-100 rounded px-2 py-0.5 text-xs mr-1">{typeof a === 'object' && a !== null ? String((a as Record<string, unknown>).name ?? a) : String(a)}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Calendar only in the All view */}
      {!parcelId && <HearingCalendar onSelect={(h) => setSelectedHearing(h)} />}
    </div>
  );
}
