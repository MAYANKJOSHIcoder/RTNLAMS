import { useParams } from "react-router-dom";
import { useHearings } from "../hooks/useHearings";
import HearingForm from "../components/hearings/HearingForm";
import HearingCalendar from "../components/hearings/HearingCalendar";

export default function Hearings() {
  const { id: selectedId } = useParams();
  const { data: allHearings = [], isLoading } = useHearings(selectedId);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">
        Hearings {selectedId ? `(Parcel: ${selectedId})` : "(All)"}
      </h1>

      {selectedId ? (
        <HearingForm parcelId={selectedId} />
      ) : null}

      <HearingCalendar onSelect={() => {}} />

      {!selectedId && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
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
