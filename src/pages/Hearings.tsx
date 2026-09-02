import { useParams } from "react-router-dom";
import HearingForm from "../components/hearings/HearingForm";
import HearingCalendar from "../components/hearings/HearingCalendar";

export default function Hearings() {
  const { id: selectedId } = useParams();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-900 mb-4">
        Hearings{" "}
        {selectedId ? `(Parcel ID: ${selectedId})` : ""}
      </h1>

      {selectedId ? (
        <>
          <HearingForm parcelId={selectedId} />
          <HearingCalendar onSelect={() => {}} />
        </>
      ) : null}
    </div>
  );
}
