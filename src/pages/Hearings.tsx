import { useState } from "react";
import { useParams } from "react-router-dom";
import { useHearings } from "../hooks/useHearings";
import HearingForm from "../components/hearings/HearingForm";
import HearingCalendar from "../components/hearings/HearingCalendar";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import type { Hearing } from "../lib/types";

export default function Hearings() {
  const { id: selectedId } = useParams();
  const { data: allHearings = [], isLoading, isError, error } = useHearings(selectedId);
  const [selectedHearing, setSelectedHearing] = useState<Hearing | null>(null);

  return (
    <div className="p-6 space-y-4">
      {isError && <ErrorBanner message={`Hearings failed to load: ${error?.message ?? 'check connection / RLS'}`} />}
      <h1 className="text-2xl font-semibold text-slate-900">
        Hearings {selectedId ? `(Parcel: ${selectedId})` : "(All)"}
      </h1>

      {selectedId ? (
        <HearingForm parcelId={selectedId} />
      ) : null}

      <HearingCalendar onSelect={(h) => setSelectedHearing(h)} />

      {selectedHearing && !selectedId && (
        <div className="bg-[#0c0c0c] border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Hearing Details</h2>
            <button onClick={() => setSelectedHearing(null)} className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer">Close</button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-slate-500">Type:</span> <span className="font-medium">{selectedHearing.type}</span></div>
            <div><span className="text-slate-500">Date:</span> <span className="font-medium">{new Date(selectedHearing.hearing_date).toLocaleString()}</span></div>
            <div><span className="text-slate-500">Parcel:</span> <span className="font-medium">{selectedHearing.parcel_id}</span></div>
            {selectedHearing.outcome && <div className="col-span-2"><span className="text-slate-500">Outcome:</span> <span className="font-medium">{selectedHearing.outcome}</span></div>}
            {selectedHearing.notes && <div className="col-span-2"><span className="text-slate-500">Notes:</span> {selectedHearing.notes}</div>}
            {selectedHearing.attendees && Array.isArray(selectedHearing.attendees) && selectedHearing.attendees.length > 0 && (
              <div className="col-span-2">
                <span className="text-slate-500">Attendees:</span>{" "}
                {(selectedHearing.attendees as unknown[]).map((a, i) => (
                  <span key={i} className="inline-block bg-slate-100 rounded px-2 py-0.5 text-xs mr-1">{typeof a === 'object' && a !== null ? String((a as Record<string, unknown>).name ?? a) : String(a)}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!selectedId && (
        <div className="bg-[#0c0c0c] border border-slate-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">All Hearings</h2>
          {isLoading ? (
            <div className="py-8 text-center text-sm text-slate-500">Loading…</div>
          ) : allHearings.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No hearings found</div>
          ) : (
            <div className="space-y-2">
              {allHearings.map((h) => (
                <div key={h.id} className="border border-slate-200 rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{h.type} — {new Date(h.hearing_date).toLocaleDateString()}</span>
                    <span className="text-slate-500">Parcel: {h.parcel_id}</span>
                  </div>
                  <div className="text-slate-600">{h.outcome ?? h.notes ?? "No details"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
