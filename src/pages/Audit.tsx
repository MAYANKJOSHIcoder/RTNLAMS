import { useParams } from "react-router-dom";
import AuditForm from "../components/audit/AuditForm";
import AuditLog from "../components/audit/AuditLog";

export default function Audit() {
  const { id: selectedId } = useParams();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-900 mb-4">
        Audit{" "}
        {selectedId ? `(Parcel ID: ${selectedId})` : ""}
      </h1>

      {selectedId ? (
        <>
          <AuditForm parcelId={selectedId} onSuccess={() => {}} />
          <AuditLog parcelId={selectedId} />
        </>
      ) : null}
    </div>
  );
}